import {useRef} from 'react'
import {useCommerceApi, useAccessToken} from '@salesforce/commerce-sdk-react'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'
import {useQueryClient} from '@tanstack/react-query'
import {noop} from '@salesforce/retail-react-app/app/utils/utils'
import PropTypes from 'prop-types'

const useCCVOrderPolling = ({
    onSuccess = noop,
    onFailed = noop,
    onError = noop,
    onPending = noop,
    config = {MAX_RETRIES: 10, TIME_BETWEEN_RETRIES: 1000}
}) => {
    const navigate = useNavigation()
    const api = useCommerceApi()
    const {getTokenWhenReady} = useAccessToken()
    const queryClient = useQueryClient()

    const {MAX_RETRIES, TIME_BETWEEN_RETRIES} = config

    let retries = 0
    let timeout = useRef(null)

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

    const checkOrderStatus = async (orderNo) => {
        try {
            order = await getOrder(orderNo)
        } catch (error) {
            return onError()
        }

        if (order.status === 'created' && retries >= MAX_RETRIES) {
            return onPending()
        }

        if (order.status === 'new') {
            return onSuccess()
        }

        if (order.status === 'failed') {
            // During the order cancellation we are redirected to the accelerator website, but if the cancel notification(CVV webhook) and the basket restoration takes longer
            // the useCurrentBasket hook is called before and an undefined basket is always returned, then the checkout component is never rendered
            queryClient.invalidateQueries({
                predicate: (query) => query.queryKey.includes('/baskets')
            })
            navigate('/checkout', 'push', {paymentErrorMsg: order.c_ccv_failure_code})
            return onFailed()
        }

        if (order.status === 'created') {
            timeout.current = setTimeout(() => {
                retries++
                checkOrderStatus(orderNo)
            }, TIME_BETWEEN_RETRIES)
        }
    }

    const startOrderStatusPolling = async (orderNo) => {
        try {
            if (!orderNo) {
                throw new Error('missing order ref')
            }

            await checkOrderStatus(orderNo)
        } catch (error) {
            onError()
        }

        return () => {
            console.log('clearing timeout')
            clearTimeout(timeout.current)
        }
    }

    return {startOrderStatusPolling}
}

useCCVOrderPolling.propTypes = {
    /** Called if order status is New (order placed) */
    onSuccess: PropTypes.func,

    /** Called if order status is Failed */
    onFailed: PropTypes.func,

    /** Called if order checking failed */
    onError: PropTypes.func,

    /** Called if order is still in status 'Created' but maximum retries have been reached */
    onPending: PropTypes.func,

    /** Config object */
    config: PropTypes.shape({
        MAX_RETRIES: PropTypes.number,
        TIME_BETWEEN_RETRIES: PropTypes.number
    })
}

export default useCCVOrderPolling
