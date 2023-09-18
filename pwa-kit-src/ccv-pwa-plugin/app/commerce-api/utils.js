import {getAppOrigin} from '@salesforce/pwa-kit-react-sdk/utils/url'

const isObject = (obj) => {
    return obj === Object(obj) && !Array.isArray(obj) && typeof obj !== 'function'
}

const toCamel = (str) => {
    if (str.startsWith('_') || str.startsWith('c_')) {
        return str
    }
    return str.replace(/([-_][a-z])/gi, ($1) => {
        return $1.toUpperCase().replace('-', '').replace('_', '')
    })
}

export const keysToCamel = (obj) => {
    if (isObject(obj)) {
        const n = {}

        Object.keys(obj).forEach((k) => {
            n[toCamel(k)] = keysToCamel(obj[k])
        })

        return n
    } else if (Array.isArray(obj)) {
        return obj.map((i) => {
            return keysToCamel(i)
        })
    }

    return obj
}

export const camelCaseKeysToUnderscore = (_obj) => {
    if (typeof _obj != 'object') return _obj

    // Copy the incoming object so we dont mutate it
    let obj
    if (Array.isArray(_obj)) {
        obj = [..._obj]
    } else {
        obj = {..._obj}
    }

    for (var oldName in obj) {
        // Camel to underscore

        let newName = oldName.replace(/([A-Z])/g, ($1) => {
            return '_' + $1.toLowerCase()
        })

        // Only process if names are different
        if (newName != oldName) {
            // Check for the old property name to avoid a ReferenceError in strict mode.
            if (Object.prototype.hasOwnProperty.call(obj, oldName)) {
                obj[newName] = obj[oldName]
                delete obj[oldName]
            }
        }

        // Recursion
        if (typeof obj[newName] == 'object') {
            obj[newName] = camelCaseKeysToUnderscore(obj[newName])
        }
    }

    return obj
}

// This function coverts errors/faults returned from the OCAPI API to the format that is returned from the CAPI
// I added the fault key to make life easier as it's hard to discern a CAPI error
export const convertOcapiFaultToCapiError = (error) => {
    return {
        title: error.message,
        type: error.type,
        detail: error.message,
        // Unique to OCAPI I think
        arguments: error.arguments,
        fault: true
    }
}

// This function checks required parameters and or body for requests to OCAPI endpoints before sending
export const checkRequiredParameters = (listOfPassedParameters, listOfRequiredParameters) => {
    const isBodyOnlyRequiredParam =
        listOfRequiredParameters.includes('body') && listOfRequiredParameters.length === 1

    if (!listOfPassedParameters.parameters && !isBodyOnlyRequiredParam) {
        return {
            title: `Parameters are required for this request`,
            type: `MissingParameters`,
            detail: `Parameters are required for this request`
        }
    }

    if (listOfRequiredParameters.includes('body') && !listOfPassedParameters.body) {
        return {
            title: `Body is required for this request`,
            type: `MissingBody`,
            detail: `Body is  required for this request`
        }
    }

    if (
        isBodyOnlyRequiredParam &&
        listOfRequiredParameters.includes('body') &&
        listOfPassedParameters.body
    ) {
        return undefined
    }

    let undefinedValues = listOfRequiredParameters.filter(
        (req) => !Object.keys(listOfPassedParameters.parameters).includes(req)
    )

    undefinedValues = undefinedValues.filter((value) => value !== 'body')

    if (undefinedValues.length) {
        return {
            title: `The following parameters were missing from your resquest: ${undefinedValues.toString()}`,
            type: `MissingParameters`,
            detail: `The following parameters were missing from your resquest: ${undefinedValues.toString()}`
        }
    } else {
        return undefined
    }
}

// This function is used to interact with the OCAPI API
export const createOcapiFetch =
    (commerceAPIConfig) => async (endpoint, method, args, methodName, body) => {
        const proxy = `/mobify/proxy/ocapi`

        // The api config will only have `ocapiHost` during testing to workaround localhost proxy
        const host = commerceAPIConfig.ocapiHost
            ? `https://${commerceAPIConfig.ocapiHost}`
            : `${getAppOrigin()}${proxy}`

        const siteId = commerceAPIConfig.parameters.siteId
        const headers = {
            ...args[0].headers,
            'Content-Type': 'application/json',
            'x-dw-client-id': commerceAPIConfig.parameters.clientId
        }

        let response
        response = await fetch(`${host}/s/${siteId}/dw/shop/v21_3/${endpoint}`, {
            method: method,
            headers: headers,
            ...(body && {
                body: JSON.stringify(body)
            })
        })
        const httpStatus = response.status

        if (!args[1] && response.json) {
            response = await response.json()
        }

        const convertedResponse = keysToCamel(response)
        if (convertedResponse.fault) {
            const error = convertOcapiFaultToCapiError(convertedResponse.fault)
            // eslint-disable-next-line no-undef
            throw new HTTPError(httpStatus, error.detail)
        } else {
            return convertedResponse
        }
    }
