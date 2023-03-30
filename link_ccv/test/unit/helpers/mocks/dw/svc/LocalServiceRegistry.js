module.exports = class LocalServiceRegistry {
    static createService() {
        return function () {
            return {
                object: {}
            };
        };
    }
};
