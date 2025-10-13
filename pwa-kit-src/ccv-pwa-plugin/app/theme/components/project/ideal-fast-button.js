import React from 'react'
import {IdealFastIcon} from '../../../components/icons'

export default {
    baseStyle: {
        button: {
            variant: 'solid',
            width: ['95%', '95%', '95%', '100%'],
            _hover: {
                bgColor: '#b70062'
            },
            _disabled: {},
            bgColor: '#cb0166',
            marginTop: 3,
            mb: 4,
            leftIcon: <IdealFastIcon h="1.8rem" w="auto" />
        },
        errorStyle: {
            color: 'red.500',
            bg: 'white',
            p: 3,
            mt: {base: '-1rem', lg: 0}
        }
    },
    parts: [
        'container',
        'inputContainer',
        'heading',
        'subtitle',
        'input',
        'image',
        'submitBtn',
        'errorStyle'
    ]
}
