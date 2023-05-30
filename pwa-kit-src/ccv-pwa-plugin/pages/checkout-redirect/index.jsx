import React, {useEffect, useContext, useRef, useCallback} from 'react'
import useNavigation from '../../../app/hooks/use-navigation'
import CheckoutSkeleton from '../../../app/pages/checkout/partials/checkout-skeleton'
import {Box, Text} from '@chakra-ui/react'
import {BasketContext} from '../../../app/commerce-api/contexts'
import useCustomer from '../../../app/commerce-api/hooks/useCustomer'

const CheckoutRedirect = () => {
    const navigate = useNavigation()
    const {setBasket} = useContext(BasketContext)
    const customer = useCustomer()

    const MAX_RETRIES = 10
    const TIME_BETWEEN_RETRIES = 1000
    let retries = 0
    let timeout = useRef(null)

    const checkOrderStatus = useCallback(async (orderNo, order) => {
        let getOrderError = false

        if (!order) {
            try {
                order = await customer.getOrder(orderNo)
            } catch (error) {
                getOrderError = true
                console.log('Error getting order', error)
            }
        }

        if ((retries >= MAX_RETRIES && order.status === 'created') || order.status === 'new') {
            // we will update the c_order_status_pending on the confirmation page, to ensure the basket
            // update doesn't happen before we redirect
            await setBasket({
                ...order,
                c_order_status_pending: true
            })
            navigate('/checkout/confirmation')
            return
        }

        if (order.status === 'created' || getOrderError) {
            timeout.current = setTimeout(() => {
                retries++
                checkOrderStatus(orderNo)
            }, TIME_BETWEEN_RETRIES)
            return
        }

        if (order.status === 'failed') {
            // the old basket should have been reopened by the webook, so we want to reload it
            await setBasket({c_order_status_pending: false})

            var errorMsg = order.c_ccv_failure_code
            navigate('/checkout', 'push', {paymentErrorMsg: errorMsg})
            return
        }
    })

    useEffect(async () => {
        try {
            const urlParams = new URLSearchParams(location.search)
            const orderNo = urlParams.get('ref')
            const token = urlParams.get('token')

            if (!orderNo || !token) {
                throw new Error(`missing ${!orderNo ? 'ref' : ''} ${!token ? 'token' : ''}`)
            }

            // update the basket with c_order_status_pending so the loaded() check
            // on the basket will pass and we won't create a new basket
            await setBasket({
                c_order_status_pending: true
            })

            let order = await customer.getOrder(orderNo)

            await setBasket({
                ...order,
                c_order_status_pending: true
            })

            checkOrderStatus(orderNo, order)
        } catch (error) {
            console.log('handle shopper redirect error')
            console.log(error)
            await setBasket({c_order_status_pending: false})

            navigate('/')
        }

        return () => {
            clearTimeout(timeout.current)
        }
    }, [])

    return (
        <Box>
            <Text align="center" fontSize="xl" fontWeight="semibold" padding="20px">
                Checking transaction status...
            </Text>

            <CheckoutSkeleton />
        </Box>
    )
}

export default CheckoutRedirect
