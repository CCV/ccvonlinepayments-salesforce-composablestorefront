import {getAppOrigin} from '@salesforce/pwa-kit-react-sdk/utils/url'
import {getConfig} from '@salesforce/pwa-kit-runtime/utils/ssr-config'
import {
    checkRequiredParameters,
    createOcapiFetch,
    camelCaseKeysToUnderscore
} from '../../../commerce-api/utils'

class OcapiCCV {
    constructor() {
        const {app: appConfig} = getConfig()
        const apiConfig = {
            ...appConfig.commerceAPI,
            einsteinConfig: appConfig.einsteinAPI
        }

        this.fetch = createOcapiFetch(apiConfig)
        this.fetchController = createControllerFetch(apiConfig)
    }

    // based on ocapi-shopper-orders#createOrder
    async createOrder(...args) {
        const required = ['body', 'ccvReturnUrl']
        let requiredParametersError = checkRequiredParameters(args[0], required)
        if (requiredParametersError) {
            return requiredParametersError
        }

        const {
            parameters: {ccvReturnUrl, applePayDomainName, applePayValidationUrl, metadata},
            body
        } = args[0]

        let path = `orders?ccvReturnUrl=${ccvReturnUrl}`

        if (applePayDomainName) path += `&applePayDomainName=${applePayDomainName}`
        if (applePayValidationUrl) path += `&applePayValidationUrl=${applePayValidationUrl}`

        const ocapiVersion = `CommerceCloudOcapi:${getConfig()?.app?.commerceAPI?.ocapiVersion}`
        if (metadata) path += `&metadata=${encodeURIComponent(metadata + ';' + ocapiVersion)}`

        const underscoreBody = camelCaseKeysToUnderscore(body)

        let res;

        try {
            return await this.fetch(path, 'POST', args, 'createOrder', underscoreBody)
        } catch (e) {
            console.error(e.message)
            return null;
        }
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

        try {
            return this.fetch(`baskets/${basketId}`, 'GET', args, 'getBasketData')
        } catch (e) {
            console.error(e.message)
            return null;
        }
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

        let response = await fetch(`${host}${endpoint}`, {
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
