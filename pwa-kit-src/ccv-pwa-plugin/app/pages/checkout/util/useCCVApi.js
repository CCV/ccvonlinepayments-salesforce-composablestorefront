import {useIntl} from 'react-intl'
import {getAppOrigin} from '@salesforce/pwa-kit-react-sdk/utils/url'
import {getConfig} from '@salesforce/pwa-kit-runtime/utils/ssr-config'
import {useCommerceApi, useAccessToken} from '@salesforce/commerce-sdk-react'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'
import {useCurrentBasket} from '@salesforce/retail-react-app/app/hooks/use-current-basket'

import OcapiCCV from './ocapi-ccv'
import {createApplePayRequest} from './ccv-utils'
import ccvConfig from '../../../../ccvConfig'

const useCCVApi = () => {
    const api = useCommerceApi()
    const {locale, formatMessage} = useIntl()
    const navigate = useNavigation()
    const {data: basket} = useCurrentBasket()

    const ocapiCCVInstance = new OcapiCCV()
    const {getTokenWhenReady} = useAccessToken()
    const localeConfig = getConfig()?.app?.url?.locale

    const redirectWithLocale = localeConfig !== 'none'

    return {
        // based on useBasket#createOrder
        async createOrder({applePayValidationUrl} = {}) {
            let ccvReturnUrl = `${getAppOrigin()}/checkout/handleShopperRedirect`
            const metadata = ccvConfig.version
            if (redirectWithLocale) {
                let localeAsQueryParam = localeConfig === 'query_param'

                if (localeAsQueryParam) {
                    ccvReturnUrl = `${getAppOrigin()}/checkout/handleShopperRedirect?locale=${locale}`
                } else {
                    ccvReturnUrl = `${getAppOrigin()}/${locale}/checkout/handleShopperRedirect`
                }
            }

            const parameters = {
                ccvReturnUrl,
                metadata
            }

            if (applePayValidationUrl) {
                parameters.applePayValidationUrl = applePayValidationUrl
                parameters.applePayDomainName = window.location.hostname
            }
            const token = await getTokenWhenReady()
            const response = await ocapiCCVInstance.createOrder({
                headers: {
                    authorization: `Bearer ${token}`
                },
                body: {basketId: basket.basketId},
                parameters
            })

            if (response.fault || (response.title && response.type && response.detail)) {
                throw new Error(response.title)
            }

            return response
        },
        async submitOrderCCV({setIsLoading, setPaymentError}) {
            setIsLoading(true)
            setPaymentError(null)

            try {
                const orderResponse = await this.createOrder()

                // redirect to hosted payment page
                window.location.href = orderResponse.c_ccvPayUrl
            } catch (error) {
                setIsLoading(false)
                const message = formatMessage({
                    id: 'checkout.message.generic_error',
                    defaultMessage: 'An unexpected error occurred during checkout.'
                })

                setPaymentError(message)
            }
        },
        async submitApplePayOrderCCV({setIsLoading, setPaymentError, applePayValidationUrl}) {
            setIsLoading(true)
            setPaymentError(null)

            try {
                const orderResponse = await this.createOrder({applePayValidationUrl})

                // redirect to hosted payment page
                return orderResponse
            } catch (error) {
                setIsLoading(false)
                const message = formatMessage({
                    id: 'checkout.message.generic_error',
                    defaultMessage: 'An unexpected error occurred during checkout.'
                })

                setPaymentError(message)
            }
        },
        async submitAppleToken({encryptedToken, orderNo, orderToken, isCancelled, path}) {
            const response = await api.ccvPayment.postApplePayToken({
                headers: {_sfdc_customer_id: api.auth.usid},
                body: {encryptedToken, orderNo, orderToken, isCancelled},
                parameters: {},
                path
            })

            if (response.error) {
                throw new Error(response.title)
            }
            return response
        },
        async onApplePayButtonClicked({setIsLoading, setPaymentError}) {
            if (!window.ApplePaySession) {
                return
            }
            setPaymentError(null)

            let orderResponsePromise = {}
            let isCancelled

            const request = createApplePayRequest(basket, formatMessage, locale)

            let session = new window.ApplePaySession(3, request)

            session.onvalidatemerchant = async (event) => {
                const latestBasket = await api.ccvPayment.getBasketData({
                    headers: {_sfdc_customer_id: api.auth.usid},
                    parameters: {basketId: basket.basketId}
                })

                if (request.total.amount !== latestBasket.orderTotal) {
                    basket.updateBasketCurrency(basket.currency, basket.basketId)
                    setPaymentError('basket_stale_price')
                    session.abort()
                    return
                }
                orderResponsePromise = this.submitApplePayOrderCCV({
                    setIsLoading,
                    setPaymentError,
                    applePayValidationUrl: event.validationURL
                })

                orderResponsePromise.then((orderResponse) => {
                    if (!orderResponse) {
                        console.log('Order creation failed! Aborting payment session.')
                        return session.abort()
                    }

                    const applePayPaymentSession = JSON.parse(
                        orderResponse.c_applePayPaymentSession
                    )
                    if (!isCancelled) {
                        session.completeMerchantValidation(applePayPaymentSession)
                    }
                })
            }

            session.onpaymentauthorized = async (event) => {
                orderResponsePromise.then(async (orderResponse) => {
                    let submitTokenResponse
                    try {
                        submitTokenResponse = await this.submitAppleToken({
                            encryptedToken: event.payment.token,
                            orderNo: orderResponse.orderNo,
                            orderToken: orderResponse.orderToken,
                            path: orderResponse.c_appleTokenSubmitUrl
                        })
                    } catch (error) {
                        setIsLoading(false)
                        const message = formatMessage({
                            id: 'checkout.message.generic_error',
                            defaultMessage: 'An unexpected error occurred during checkout.'
                        })
                        setPaymentError(message)
                    }

                    const result = {
                        status: submitTokenResponse
                            ? window.ApplePaySession.STATUS_SUCCESS
                            : window.ApplePaySession.STATUS_FAILURE
                    }
                    session.completePayment(result)
                    if (submitTokenResponse?.status === 'success') {
                        navigate(
                            `/checkout/handleShopperRedirect?ref=${orderResponse.orderNo}&token=${orderResponse.orderToken}`
                        )
                    }
                })
            }

            session.oncancel = async () => {
                isCancelled = true

                orderResponsePromise.then(async (orderResponse) => {
                    if (!orderResponse) return

                    try {
                        await this.submitAppleToken({
                            encryptedToken: '',
                            path: orderResponse.c_appleTokenSubmitUrl,
                            orderNo: orderResponse.orderNo,
                            orderToken: orderResponse.orderToken,
                            isCancelled: true
                        })
                    } catch (error) {
                        console.log('Failed cancelling')
                        console.log(error)
                    }
                })
            }

            session.begin()
        }
    }
}
export default useCCVApi
