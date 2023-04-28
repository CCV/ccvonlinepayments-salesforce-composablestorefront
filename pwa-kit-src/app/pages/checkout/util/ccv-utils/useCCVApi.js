import {useCommerceAPI} from '../../../../commerce-api/contexts'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
import {useIntl} from 'react-intl'
import useBasket from '../../../../commerce-api/hooks/useBasket'

const useCCVApi = () => {
    const api = useCommerceAPI()
    const {locale, formatMessage} = useIntl()
    const basket = useBasket()

    return {
        // based on useBasket#createOrder
        async createOrder() {
            const response = await api.ccvPayment.createOrder({
                headers: {_sfdc_customer_id: api.auth.usid},
                body: {basketId: basket.basketId},
                parameters: {
                    ccvReturnUrl: `${getAppOrigin()}/${locale}/checkout/handleShopperRedirect`
                }
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
            console.log(paymentTransaction)
            if (!paymentTransaction?.c_result) {
                throw new Error('Error checking transaction status.')
            }

            return paymentTransaction.c_result
        },
        async submitOrderCCV(setIsLoading, setPaymentError) {
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
        }
    }
}
export default useCCVApi
