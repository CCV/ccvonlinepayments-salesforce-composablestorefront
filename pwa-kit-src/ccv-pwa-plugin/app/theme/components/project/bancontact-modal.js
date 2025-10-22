export default {
    baseStyle: {
        headerMsg: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between'
        },
        bancontactIcon: {
            width: 'auto',
            height: '2.5rem'
        },
        button: {
            variant: 'solid',
            width: ['95%', '95%', '95%', '100%'],
            _hover: {
                bgColor: '#b70062'
            },
            _disabled: {},
            bgColor: '#cb0166',
            marginTop: 3,
            mb: 4
        },
        stack: {
            align: 'center'
        },
        orderTotal: {
            display: 'flex',
            gap: '1rem',
            marginY: 5,
            fontWeight: 'bold',
            fontSize: 'lg',
            textAlign: 'center'
        },
        qrCodeContainer: {
            mb: '1.5rem'
        },
        openAppBtn: {
            colorScheme: 'blue',
            as: 'a',
            w: '100%'
        },
        redirectBtn: {
            colorScheme: 'blue',
            as: 'a',
            w: '100%'
        },
        cancelBtn: {
            colorScheme: 'blue',
            variant: 'outline'
        }
    },
    parts: [
        'headerMsg',
        'bancontactIcon',
        'button',
        'stack',
        'orderTotal',
        'qrCodeContainer',
        'openAppBtn',
        'redirectBtn',
        'cancelBtn'
    ]
}
