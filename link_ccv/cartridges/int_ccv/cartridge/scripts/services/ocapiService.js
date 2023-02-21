'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

/**
 * creates a ocapi service
 * @returns {Object} Parsed JSON response; if status is not ok - whole response is returned
 */
function createOcapiService() {
    return LocalServiceRegistry.createService('ocapi.service', {
        createRequest: function (service, params) {
            service.addHeader('Authorization', 'Bearer ' + getBearerTokenFromRequest());
            service.addHeader('Content-Type', 'application/json');
            service.setRequestMethod(params.requestMethod);
            service.setURL(params.requestPath);

            return JSON.stringify(params.requestBody);
        },
        parseResponse: function (service, response) {
            if (response.statusCode === 200) {
                return JSON.parse(response.text);
            }

            return response;
        }
    });
}
/**
 * Gets the bearer token from the initial request so it can be reused for ocapi calls
 * @returns {string} bearer token
 */
function getBearerTokenFromRequest() {
    var bearer = request.httpHeaders['x-is-authorization'];
    if (!bearer || !bearer.includes('Bearer')) {
        throw new Error('No bearer token found in request');
    }
    // strip bearer keyword
    bearer = bearer.replace('Bearer ', '');
    return bearer;
}

module.exports = {
    createOcapiService
};
