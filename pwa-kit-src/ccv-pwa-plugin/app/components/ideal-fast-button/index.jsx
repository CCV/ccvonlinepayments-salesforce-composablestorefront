import React, {useRef, useEffect} from 'react'
import PropTypes from 'prop-types'
import {FormattedMessage} from 'react-intl'
import {
    Box,
    Button,
    useMultiStyleConfig
} from '@salesforce/retail-react-app/app/components/shared/ui'
import useCCVApi from '../../pages/checkout/util/useCCVApi'
import {useCCVPayment} from '../../pages/checkout/util/ccv-context'

const IdealFastButton = ({variant}) => {
    const {createOrder} = useCCVApi()
    const {
        isCCVError,
        setIsCCVError,
        isCCVSubmitting,
        setIsCCVSubmitting,
        idealFastCheckoutEnabled
    } = useCCVPayment()
    const errorRef = useRef(null)
    const styles = useMultiStyleConfig('IdealFastButton', {variant})

    useEffect(() => {
        if (isCCVError && errorRef.current) {
            errorRef.current.scrollIntoView({behavior: 'smooth', block: 'center'})
        }
    }, [isCCVError])

    if (!idealFastCheckoutEnabled) return null

    const handleIdealFastCheckout = async () => {
        setIsCCVError(false)
        setIsCCVSubmitting(true)
        try {
            const orderResponse = await createOrder({
                params: {paymentMethodId: 'idealFastCheckout'}
            })
            window.location.href = orderResponse.c_ccvPayUrl
        } catch (error) {
            console.error(error)
            setIsCCVError(true)
        }
        setIsCCVSubmitting(false)
    }
    return (
        <>
            <Button
                {...styles.button}
                isLoading={isCCVSubmitting}
                onClick={handleIdealFastCheckout}
            >
                <FormattedMessage
                    defaultMessage="Fast checkout"
                    id="cart_cta.ideal_fast_checkout.button_text"
                />
            </Button>
            {isCCVError && (
                <Box ref={errorRef} {...styles.errorStyle}>
                    <FormattedMessage
                        defaultMessage="The request could not be processed at this time. Please try again later or use a different payment method."
                        id="cart_cta.ideal_fast_checkout.error"
                    />
                </Box>
            )}
        </>
    )
}

IdealFastButton.propTypes = {
    // style variant for the button
    variant: PropTypes.string
}

export default IdealFastButton
