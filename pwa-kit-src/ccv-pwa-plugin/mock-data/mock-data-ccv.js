export const mockPaymentMethodsCCV = {
    _v: '21.3',
    _type: 'payment_method_result',
    applicable_payment_methods: [
        {
            _type: 'payment_method',
            id: 'CCV_CREDIT_CARD',
            name: 'Credit Card',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'card',
            c_ccvOptions: [
                {brand: 'visa'},
                {brand: 'mastercard'},
                {brand: 'maestro'},
                {qr: 'true', brand: 'bcmc'},
                {brand: 'amex'}
            ]
        },
        {
            _type: 'payment_method',
            description: 'PayPal via CCV',
            id: 'CCV_PAYPAL',
            name: 'PayPal',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'paypal'
        },
        {
            _type: 'payment_method',
            id: 'CCV_IDEAL',
            name: 'iDEAL',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'ideal',
            c_ccvOptions: [
                {
                    issuerdescription: 'Issuer Simulation V3 - ING',
                    issuerid: 'INGBNL2A',
                    grouptype: 'country',
                    group: 'Nederland'
                },
                {
                    issuerdescription: 'Issuer Simulation V3 - RABO',
                    issuerid: 'RABONL2U',
                    grouptype: 'country',
                    group: 'Nederland'
                }
            ]
        },
        {_type: 'payment_method', id: 'CCV_SOFORT', name: 'Sofort', c_ccvMethodId: 'sofort'},
        {
            _type: 'payment_method',
            id: 'CCV_GIROPAY',
            name: 'Giropay',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'giropay',
            c_ccvOptions: [
                {issuerdescription: 'CCVPay GiroPay Simulator', issuerid: 'CCVXXX123456'}
            ]
        },
        {
            _type: 'payment_method',
            description: 'Credit card',
            id: 'CCV_CREDIT_CARD_INLINE',
            name: 'Credit card inline',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'card',
            c_ccvOptions: [
                {brand: 'visa'},
                {brand: 'mastercard'},
                {brand: 'maestro'},
                {qr: 'true', brand: 'bcmc'},
                {brand: 'amex'}
            ]
        },
        {
            _type: 'payment_method',
            id: 'CCV_BANCONTACT',
            name: 'Bancontact',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'card',
            c_ccvOptions: [
                {brand: 'visa'},
                {brand: 'mastercard'},
                {brand: 'maestro'},
                {qr: 'true', brand: 'bcmc'},
                {brand: 'amex'}
            ]
        },
        {
            _type: 'payment_method',
            id: 'CCV_PAYCONIQ',
            name: 'Payconiq',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'payconiq'
        },
        {
            _type: 'payment_method',
            id: 'CCV_EPS',
            name: 'EPS',
            payment_processor_id: 'CCV_DEFAULT',
            c_ccvMethodId: 'eps'
        }
    ]
}
