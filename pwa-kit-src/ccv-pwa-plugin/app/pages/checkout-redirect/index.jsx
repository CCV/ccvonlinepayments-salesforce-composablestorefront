import React, {useEffect, useRef, useCallback} from 'react'
import {Box, Text} from '@chakra-ui/react'
import {useCommerceApi, useAccessToken} from '@salesforce/commerce-sdk-react'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'
import CheckoutSkeleton from '@salesforce/retail-react-app/app/pages/checkout/partials/checkout-skeleton'
import {useQueryClient} from '@tanstack/react-query'

const CheckoutRedirect = () => {
    const navigate = useNavigation()
    const api = useCommerceApi()
    const {getTokenWhenReady} = useAccessToken()
    const queryClient = useQueryClient()
    const MAX_RETRIES = 10
    const TIME_BETWEEN_RETRIES = 1000
    let retries = 0
    let timeout = useRef(null)
    const onClient = typeof window !== 'undefined'
    const urlParams = onClient && new URLSearchParams(location.search)
    const orderNo = onClient && urlParams.get('ref')

    let order = null

    const getOrder = async (orderNo) => {
        const token = await getTokenWhenReady()
        const order = await api.shopperOrders.getOrder({
            parameters: {
                orderNo
            },
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        return order
    }

    const checkOrderStatus = useCallback(async (orderNo, order) => {
        let getOrderError = false

        if (!order) {
            order = await getOrder(orderNo)
        }

        if ((retries >= MAX_RETRIES && order.status === 'created') || order.status === 'new') {
            navigate(`/checkout/confirmation/${orderNo}`)
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
            // During the order cancellation we are redirected to the accelerator website, but if the cancel notification(CVV webhook) and the basket restoration takes longer
            // the useCurrentBasket hook is called before and an undefined basket is always returned, then the checkout component is never rendered
            queryClient.invalidateQueries({
                predicate: (query) => query.queryKey.includes('/baskets')
            })
            navigate('/checkout', 'push', {paymentErrorMsg: order.c_ccv_failure_code})
        }
    })

    const orderStatusCheck = async () => {
        try {
            if (!orderNo) {
                throw new Error('missing order ref')
            }

            order = await getOrder(orderNo)

            await checkOrderStatus(orderNo, order)
        } catch (error) {
            console.log('handle shopper redirect error')
            console.log(error)

            navigate('/')
        }

        return () => {
            clearTimeout(timeout.current)
        }
    }

    useEffect(() => {
        orderStatusCheck()
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
