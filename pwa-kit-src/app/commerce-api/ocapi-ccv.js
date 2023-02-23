import {checkRequiredParameters, createOcapiFetch} from './utils'

class OcapiCCV {
    constructor(config) {
        this.fetch = createOcapiFetch(config)
    }

    async createRedirectSession(...args) {
        const required = ['returnUrl', 'paymentType']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }
        let {
            parameters: {returnUrl, paymentType, ccv_option}
        } = args[0]

        if (!paymentType) {
            throw new Error('No payment type set.')
        }
        return this.fetch(
            `custom_objects/CustomApi/create-ccv-payment?c_returnUrl=${returnUrl}&c_type=${paymentType}&c_ccv_option=${ccv_option}`,
            'GET',
            args,
            'createPaymentSession'
        )
    }

    async checkTransactionStatus(...args) {
        const result = await this.fetch(
            `custom_objects/CustomApi/check-transaction-status`,
            'GET',
            args
        )
        return result?.c_result
    }
}
export default OcapiCCV
