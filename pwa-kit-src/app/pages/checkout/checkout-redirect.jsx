import React, {useEffect} from 'react'
import useNavigation from '../../hooks/use-navigation'
import useCustomer from '../../commerce-api/hooks/useCustomer'
import useBasket from '../../commerce-api/hooks/useBasket'
import {CheckoutProvider, useCheckout} from './util/checkout-context'
import CheckoutSkeleton from './partials/checkout-skeleton'
import useCCV from '../../commerce-api/hooks/useCCV'

const Checkout = () => {
    const ccv = useCCV()
    const navigate = useNavigation()
    const {placeOrder, setGlobalError} = useCheckout()

    useEffect(async () => {
        let transactionSatus = await ccv.checkTransactionStatus()
        console.log(transactionSatus)

        if (transactionSatus.status === 'failed') {
            // // Handle errors
            setGlobalError('There is an error processing your payment, please try again.')
            navigate('/checkout')
        } else {
            try {
                await placeOrder()
                navigate('/checkout/confirmation')
            } catch (error) {
                console.log(error)
            }
        }
    }, [])

    return <div>Redirect Page</div>
}
const CheckoutRedirect = () => {
    const customer = useCustomer()
    const basket = useBasket()
    if (!customer || !customer.customerId || !basket || !basket.basketId) {
        return <CheckoutSkeleton />
    }
    return (
        <CheckoutProvider>
            <Checkout />
        </CheckoutProvider>
    )
}
export default CheckoutRedirect
