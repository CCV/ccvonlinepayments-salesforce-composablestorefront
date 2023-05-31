import {checkRequiredParameters, createOcapiFetch} from '../../../../app/commerce-api/utils'
import {camelCaseKeysToUnderscore} from '../../../../app/commerce-api/utils'
import {getAppOrigin} from 'pwa-kit-react-sdk/utils/url'
class OcapiCCV {
    constructor(config) {
        this.fetch = createOcapiFetch(config)
        this.fetchController = createControllerFetch(config)
    }

    // based on ocapper-shopper-orders#createOrder
    async createOrder(...args) {
        const required = ['body', 'ccvReturnUrl']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }

        const {
            parameters: {ccvReturnUrl, applePayDomainName, applePayValidationUrl},
            body
        } = args[0]

        let path = `orders?ccvReturnUrl=${ccvReturnUrl}`

        if (applePayDomainName) path += `&applePayDomainName=${applePayDomainName}`
        if (applePayValidationUrl) path += `&applePayValidationUrl=${applePayValidationUrl}`

        return await this.fetch(path, 'POST', args, 'createOrder', camelCaseKeysToUnderscore(body))
    }

    async postApplePayToken(...args) {
        const required = ['body']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }

        const {body, path} = args[0]

        return await this.fetchController(path, 'POST', args, 'postApplePayToken', body)
    }

    async getBasketData(...args) {
        const required = ['basketId']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }
        let {
            parameters: {basketId}
        } = args[0]

        return this.fetch(`baskets/${basketId}`, 'GET', args, 'getBasketData')
    }
}

export const createControllerFetch =
    (commerceAPIConfig) => async (endpoint, method, args, methodName, body) => {
        const proxy = `/mobify/proxy/ocapi`

        // The api config will only have `ocapiHost` during testing to workaround localhost proxy
        const host = commerceAPIConfig.ocapiHost
            ? `https://${commerceAPIConfig.ocapiHost}`
            : `${getAppOrigin()}${proxy}`

        const headers = {
            ...args[0].headers,
            'Content-Type': 'application/json',
            'x-dw-client-id': commerceAPIConfig.parameters.clientId
        }

        let response
        response = await fetch(`${host}${endpoint}`, {
            method: method,
            headers: headers,
            ...(body && {
                body: JSON.stringify(body)
            })
        })

        if (!args[1] && response.json) {
            response = await response.json()
        }

        return response
    }

export default OcapiCCV
