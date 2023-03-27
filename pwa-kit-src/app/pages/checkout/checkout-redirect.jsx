import React, {useEffect, useContext} from 'react'
import useNavigation from '../../hooks/use-navigation'
import CheckoutSkeleton from './partials/checkout-skeleton'
import useCCVApi from './util/ccv-utils/useCCVApi'
import {Box, Text} from '@chakra-ui/react'
import {BasketContext} from '../../commerce-api/contexts'

const CheckoutRedirect = () => {
    const navigate = useNavigation()
    const {setBasket} = useContext(BasketContext)
    const ccv = useCCVApi()

    useEffect(async () => {
        try {
            const urlParams = new URLSearchParams(location.search)
            const ref = urlParams.get('ref')
            const token = urlParams.get('token')
            const newOrderData = JSON.parse(localStorage.getItem('newOrderData'))

            // if we don't have newOrderData, we can't show a confirmation page, so we
            // throw an error and redirect to home. However, the order is still created and
            // will be processed by the updateTransactionStatuses job
            if (!ref || !token || !newOrderData) {
                throw new Error()
            }

            // update the basket with the new order data and pass c_order_status_pending
            // so loaded() check on the basket will pass and we won't create a new basket
            await setBasket({
                ...newOrderData,
                c_order_status_pending: true
            })
            const transactionStatus = await ccv.checkTransactionStatus({parameters: {ref, token}})

            if (!transactionStatus) {
                throw new Error()
            } else if (transactionStatus.status === 'failed') {
                await setBasket({c_order_status_pending: false})
                localStorage.removeItem('newOrderData')

                navigate('/checkout', 'push', {paymentErrorMsg: transactionStatus.errorMsg})
            } else {
                await setBasket({
                    ...newOrderData,
                    c_order_status_pending: false
                })
                localStorage.removeItem('newOrderData')

                navigate('/checkout/confirmation')
            }
        } catch (error) {
            await setBasket({c_order_status_pending: false})
            localStorage.removeItem('newOrderData')

            navigate('/')
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
