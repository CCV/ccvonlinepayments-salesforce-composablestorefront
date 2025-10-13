import React from 'react'
import BaseCart from '@salesforce/retail-react-app/app/pages/cart'
import {CCVPaymentProvider} from '../checkout/util/ccv-context'

const Cart = () => {
    return (
        <CCVPaymentProvider>
            <BaseCart />
        </CCVPaymentProvider>
    )
}

export default Cart
