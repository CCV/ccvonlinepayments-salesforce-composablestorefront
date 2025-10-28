import {getAppOrigin} from '@salesforce/pwa-kit-react-sdk/utils/url'
import {useAccessToken} from '@salesforce/commerce-sdk-react'
import useConfig from '@salesforce/commerce-sdk-react/hooks/useConfig'
import useMultiSite from '@salesforce/retail-react-app/app/hooks/use-multi-site'

export const useCustomAPIFetch = function () {
    const {organizationId} = useConfig()
    const {getTokenWhenReady} = useAccessToken()
    const {locale, site} = useMultiSite()

    const proxy = `/mobify/proxy/api`
    const host = `${getAppOrigin()}${proxy}`

    return {
        callCustomAPI: async ({body, method = 'GET', endpoint, apiName, urlParams}) => {
            const token = await getTokenWhenReady()
            const params = new URLSearchParams({
                siteId: site.id,
                locale: locale.id,
                ...urlParams
            }).toString()

            const response = await fetch(
                `${host}/custom/${apiName}/v1/organizations/${organizationId}/${endpoint}?${params}`,
                {
                    method,
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    ...(body && {
                        body: JSON.stringify(body)
                    })
                }
            )
            return response
        }
    }
}
