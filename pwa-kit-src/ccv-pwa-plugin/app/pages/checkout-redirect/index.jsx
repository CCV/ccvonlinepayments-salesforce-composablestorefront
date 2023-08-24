import React, {useEffect, useRef, useCallback} from 'react'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'
import CheckoutSkeleton from '@salesforce/retail-react-app/app/pages/checkout/partials/checkout-skeleton'
import {Box, Text} from '@chakra-ui/react'
import {useCommerceApi, useAccessToken} from '@salesforce/commerce-sdk-react'

const CheckoutRedirect = () => {
    const navigate = useNavigation()
    // const {setBasket} = useContext(BasketContext)
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
            // we will update the c_order_status_pending on the confirmation page, to ensure the basket
            // update doesn't happen before we redirect
            // await setBasket({
            //     ...order,
            //     c_order_status_pending: true
            // })
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
            // the old basket should have been reopened by the webook, so we want to reload it
            // await setBasket({c_order_status_pending: false})

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

            // update the basket with c_order_status_pending so the loaded() check
            // on the basket will pass and we won't create a new basket
            // await setBasket({
            //     c_order_status_pending: true
            // })

            order = await getOrder(orderNo)

            // await setBasket({
            //     ...order,
            //     c_order_status_pending: true
            // })

            checkOrderStatus(orderNo, order)
        } catch (error) {
            console.log('handle shopper redirect error')
            console.log(error)
            // await setBasket({c_order_status_pending: false})

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
