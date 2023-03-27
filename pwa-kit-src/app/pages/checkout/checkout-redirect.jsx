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

            let transactionStatus = await ccv.checkTransactionStatus({parameters: {ref, token}})

            if (!transactionStatus || transactionStatus.status === 'failed') {
                localStorage.removeItem('newOrderData')
                throw new Error(transactionStatus.errorMsg)
            } else {
                await setBasket(JSON.parse(localStorage.getItem('newOrderData')))
                localStorage.removeItem('newOrderData')
                navigate('/checkout/confirmation')
            }
        } catch (error) {
            console.log(error)
            navigate('/checkout', 'push', {paymentErrorMsg: error.message})
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
