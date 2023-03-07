import React, {useEffect} from 'react'
import useNavigation from '../../hooks/use-navigation'
import useCustomer from '../../commerce-api/hooks/useCustomer'
import useBasket from '../../commerce-api/hooks/useBasket'
import {CheckoutProvider, useCheckout} from './util/checkout-context'
import CheckoutSkeleton from './partials/checkout-skeleton'
import useCCV from '../../commerce-api/hooks/useCCV'
import {Box, Text} from '@chakra-ui/react'

const Checkout = () => {
    const ccv = useCCV()
    const navigate = useNavigation()
    const {placeOrder} = useCheckout()

    useEffect(async () => {
        try {
            let transactionSatus = await ccv.checkTransactionStatus()
            console.log(transactionSatus)

            if (!transactionSatus || transactionSatus.status === 'failed') {
                navigate('/checkout')
            } else {
                await placeOrder()
                navigate('/checkout/confirmation')
            }
        } catch (error) {
            console.log(error)
            navigate('/checkout')
        }
    }, [])

    return (
        <Box>
            <Text align="center" fontSize="xl" fontWeight="semibold">
                Checking transaction status...
            </Text>
            <CheckoutSkeleton />
        </Box>
    )
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
