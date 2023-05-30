import {useCommerceAPI} from '../../../../app/commerce-api/contexts'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
import {useIntl} from 'react-intl'
import useBasket from '../../../../app/commerce-api/hooks/useBasket'
import ccvConfig from '../../../ccvConfig'
import useNavigation from '../../../../app/hooks/use-navigation'

const useCCVApi = () => {
    const api = useCommerceAPI()
    const {formatMessage} = useIntl()
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
        async checkTransactionStatus({parameters}) {
            const paymentTransaction = await api.ccvPayment.checkTransactionStatus({
                // eslint-disable-next-line prettier/prettier
                parameters: parameters
            })

            if (!paymentTransaction?.c_result) {
                throw new Error('Error checking transaction status.')
            }

            return paymentTransaction.c_result
        },
        async submitOrderCCV({setIsLoading, setPaymentError}) {
            setIsLoading(true)
            setPaymentError(null)

            try {
                const orderResponse = await this.createOrder()
                localStorage.setItem('newOrderData', JSON.stringify(orderResponse))

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
                localStorage.setItem('newOrderData', JSON.stringify(orderResponse))

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
        async submitAppleToken({
            encryptedToken,
            orderNo,
            orderToken,
            isCancelled,
            path,
            setIsLoading,
            setPaymentError
        }) {
            try {
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
            } catch (error) {
                setIsLoading(false)
                const message = formatMessage({
                    id: 'checkout.message.generic_error',
                    defaultMessage: 'An unexpected error occurred during checkout.'
                })

                setPaymentError(message)
            }
        },
        async onApplePayButtonClicked({setIsLoading, setPaymentError}) {
            if (!window.ApplePaySession) {
                return
            }
            let orderResponsePromise = {}
            let isCancelled

            var total = {
                label: ccvConfig.applePayMerchantLabel,
                type: 'final',
                amount: basket?.orderTotal
            }

            const request = {
                countryCode: 'BE',
                currencyCode: basket?.currency,
                merchantCapabilities: ['supports3DS'],
                supportedNetworks: ['MasterCard', 'Visa'],
                total: total
            }

            let session = new window.ApplePaySession(3, request)

            session.onvalidatemerchant = async (event) => {
                console.log('At merchant validation')

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
                console.log('At payment authorized')
                orderResponsePromise.then(async (orderResponse) => {
                    const submitTokenResponse = await this.submitAppleToken({
                        encryptedToken: event.payment.token,
                        path: orderResponse.c_appleTokenSubmitUrl,
                        orderNo: orderResponse.orderNo,
                        orderToken: orderResponse.orderToken,
                        setIsLoading,
                        setPaymentError
                    })

                    console.log(submitTokenResponse)
                    const result = {
                        status:
                            submitTokenResponse.status === 'failed'
                                ? window.ApplePaySession.STATUS_FAILURE
                                : window.ApplePaySession.STATUS_SUCCESS
                    }
                    session.completePayment(result)
                    if (submitTokenResponse.status === 'failed') {
                        setPaymentError('payment_failed')
                        setIsLoading(false)
                        return
                    } else {
                        navigate(
                            `/checkout/handleShopperRedirect?ref=${orderResponse.orderNo}&token=${orderResponse.orderToken}`
                        )
                    }
                })
            }

            session.oncancel = async () => {
                console.log('At cancel')
                isCancelled = true

                orderResponsePromise.then(async (orderResponse) => {
                    if (!orderResponse) return

                    try {
                        await this.submitAppleToken({
                            encryptedToken: '',
                            path: orderResponse.c_appleTokenSubmitUrl,
                            orderNo: orderResponse.orderNo,
                            orderToken: orderResponse.orderToken,
                            isCancelled: true,
                            setIsLoading,
                            setPaymentError
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
