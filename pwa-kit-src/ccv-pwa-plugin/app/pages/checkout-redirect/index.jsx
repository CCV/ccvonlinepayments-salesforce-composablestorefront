import React, {useEffect, useRef, useCallback} from 'react'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'
import CheckoutSkeleton from '@salesforce/retail-react-app/app/pages/checkout/partials/checkout-skeleton'
import {Box, Text} from '@chakra-ui/react'
import {useCommerceApi, useAccessToken} from '@salesforce/commerce-sdk-react'

const CheckoutRedirect = () => {
    const navigate = useNavigation()
    const api = useCommerceApi()
    const {getTokenWhenReady} = useAccessToken()

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
        const order = await api.shopperOrders.getOrder(
            {
                parameters: {
                    orderNo
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )

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
            var errorMsg = order.c_ccv_failure_code
            navigate('/checkout', 'push', {paymentErrorMsg: errorMsg})
            return
        }
    })

    const orderStatusCheck = async () => {
        try {
            if (!orderNo) {
                throw new Error('missing order ref')
            }

            order = await getOrder(orderNo)

            checkOrderStatus(orderNo, order)
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
