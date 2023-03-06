import {useCommerceAPI} from '../contexts'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
import {useIntl} from 'react-intl'
import {useCheckout} from '../../pages/checkout/util/checkout-context'

const useCCV = () => {
    const api = useCommerceAPI()
    const {locale} = useIntl()
    const {selectedPayment, paymentMethods, setGlobalError} = useCheckout()
    const {formatMessage} = useIntl()

    return {
        async createRedirectSession() {
            const ccvId = paymentMethods.applicablePaymentMethods.find(
                (method) => method.id === selectedPayment.paymentMethodId
            ).c_ccvMethodId

            const paymentSession = await api.ccvPayment.createRedirectSession({
                parameters: {
                    paymentType: ccvId,
                    returnUrl: `${getAppOrigin()}/${locale}/checkout/handleShopperRedirect`
                }
            })
            if (!paymentSession.c_result || !paymentSession.c_result.payUrl) {
                throw new Error('Error creating payment redirect.')
            }

            return paymentSession.c_result
        },
        async checkTransactionStatus() {
            const paymentTransaction = await api.ccvPayment.checkTransactionStatus({
                // eslint-disable-next-line prettier/prettier
                parameters: {}
            })
            if (!paymentTransaction?.status) {
                throw new Error('Error checking transaction status.')
            }

            return paymentTransaction
        },
        async submitOrder(setIsLoading) {
            try {
                setIsLoading(true)
                // create redirect session via ccv api
                const createRedirectSessionResponse = await this.createRedirectSession()
                // redirect to hosted payment page
                window.location.href = createRedirectSessionResponse.payUrl
            } catch (error) {
                setIsLoading(false)
                const message = formatMessage({
                    id: 'checkout.message.generic_error',
                    defaultMessage: 'An unexpected error occurred during checkout.'
                })
                setGlobalError(message)
            }
        }
    }
}
export default useCCV
