import {useCommerceAPI} from '../../../../commerce-api/contexts'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
import {useIntl} from 'react-intl'

const useCCVApi = () => {
    const api = useCommerceAPI()
    const {locale, formatMessage} = useIntl()

    return {
        async createRedirectSession() {
            const paymentSession = await api.ccvPayment.createRedirectSession({
                // headers: {_sfdc_customer_id: api.auth.usid},
                parameters: {
                    returnUrl: `${getAppOrigin()}/${locale}/checkout/handleShopperRedirect`
                }
            })
            const result = paymentSession?.c_result
            if (!result || result.errorMsg || !result.payUrl) {
                throw new Error(result.errorMsg || 'Error creating payment redirect.')
            }

            return result
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
            try {
                setIsLoading(true)
                setPaymentError('')
                // create redirect session via ccv api
                const createRedirectSessionResponse = await this.createRedirectSession()
                localStorage.setItem(
                    'newOrderData',
                    JSON.stringify(createRedirectSessionResponse.order)
                )

                // redirect to hosted payment page
                window.location.href = createRedirectSessionResponse.payUrl
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
