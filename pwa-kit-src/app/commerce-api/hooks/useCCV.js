import {useCommerceAPI} from '../contexts'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
import {useIntl} from 'react-intl'

const useCCV = () => {
    const api = useCommerceAPI()
    const {locale} = useIntl()

    return {
        async createRedirectSession({paymentType, option}) {
            const paymentSession = await api.ccvPayment.createRedirectSession({
                parameters: {
                    paymentType: paymentType,
                    option: option,
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
            if (!paymentTransaction?.transactionStatus) {
                throw new Error('Error creating payment redirect.')
            }

            return paymentTransaction.transactionStatus
        }
    }
}
export default useCCV
