import {useCommerceAPI} from '../../../../commerce-api/contexts'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
import {useIntl} from 'react-intl'

const useCCVApi = () => {
    const api = useCommerceAPI()
    const {locale} = useIntl()

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
        }
    }
}
export default useCCVApi
