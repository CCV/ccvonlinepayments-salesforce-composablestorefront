import {useCommerceAPI} from '../../../../app/commerce-api/contexts'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
import {useIntl} from 'react-intl'
import useBasket from '../../../../app/commerce-api/hooks/useBasket'
import useNavigation from '../../../../app/hooks/use-navigation'
import {createApplePayRequest} from './ccv-utils'

const useCCVApi = () => {
    const api = useCommerceAPI()
    const {locale, formatMessage} = useIntl()
    const basket = useBasket()
    const navigate = useNavigation()

    return {
        // based on useBasket#createOrder
        async createOrder({applePayValidationUrl} = {}) {
            const parameters = {
                ccvReturnUrl: `${getAppOrigin()}/checkout/handleShopperRedirect`
            }
            if (applePayValidationUrl) {
                parameters.applePayValidationUrl = applePayValidationUrl
                parameters.applePayDomainName = window.location.hostname
            }
            const response = await api.ccvPayment.createOrder({
                headers: {_sfdc_customer_id: api.auth.usid},
                body: {basketId: basket.basketId},
                parameters
            })

            if (response.fault || (response.title && response.type && response.detail)) {
                throw new Error(response.title)
            }

            return response
        },
        async submitOrderCCV({setIsLoading, setPaymentError, creditCardData}) {
            setIsLoading(true)
            setPaymentError(null)

            try {
                const orderResponse = await this.createOrder()
                if (orderResponse.c_card_data_url) {
                    const cardDataResponse = await fetch(orderResponse.c_card_data_url, {
                        method: 'POST',
                        body: JSON.stringify(creditCardData),
                        headers: {
                            "Content-Type": "application/json",
                          },
                    })
                    console.log(cardDataResponse)
                }
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
