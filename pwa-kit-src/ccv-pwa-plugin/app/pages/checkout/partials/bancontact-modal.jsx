import React, {useEffect, useState} from 'react'
import QRCode from 'react-qr-code'
import PropTypes from 'prop-types'
import {FormattedMessage, FormattedNumber} from 'react-intl'
import {
    Box,
    Button,
    Alert,
    AlertIcon,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    useMultiStyleConfig,
    useBreakpointValue,
    Stack,
    Divider,
    Text
} from '@salesforce/retail-react-app/app/components/shared/ui'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'
import {BanContactIcon} from '../../../components/icons'
import {useCCVPayment} from '../util/ccv-context'
import useCCVOrderPolling from '../util/useOrderPolling'
import {useCustomAPIFetch} from '../../../hooks/use-custom-api-fetch'

const MAX_RETRIES = 400
const TIME_BETWEEN_RETRIES = 1000

function BancontactModal({setPlaceOrderBtnLoading}) {
    const {isBancontactModalOpen, onBancontactModalOpen, onBancontactModalClose, orderResponse} =
        useCCVPayment()
    const navigate = useNavigation()
    const [isCanceling, setIsCanceling] = useState()
    const {callCustomAPI} = useCustomAPIFetch()
    const styles = useMultiStyleConfig('BancontactModal')
    const isMobile = useBreakpointValue({base: true, md: false})

    const handleCloseModal = () => {
        setPlaceOrderBtnLoading(false)
        onBancontactModalClose()
    }

    const {startOrderStatusPolling} = useCCVOrderPolling({
        onSuccess: () => {
            navigate(`/checkout/confirmation/${orderResponse.orderNo}`)
        },
        onFailed: () => {
            handleCloseModal()
        },
        onError: () => {
            handleCloseModal()
        },
        onPending: () => {
            navigate(`/checkout/confirmation/${orderResponse.orderNo}`)
        },
        config: {MAX_RETRIES, TIME_BETWEEN_RETRIES}
    })

    const cancelPayment = async () => {
        setIsCanceling(true)

        try {
            const cancelResult = await callCustomAPI({
                endpoint: `cancel-payment`,
                method: 'POST',
                body: {
                    orderNo: orderResponse?.orderNo,
                    orderToken: orderResponse?.orderToken
                },
                apiName: 'ccv'
            })
            if (!cancelResult || cancelResult.status !== 200) {
                throw new Error('Could not cancel order')
            }
        } catch (error) {
            console.error(error)
            window.location.reload()
        }

        setIsCanceling(false)
    }

    const payUrl = orderResponse?.c_ccvPayUrl
    const qrCode = orderResponse?.c_ccvQrCode
    const urlIntent = orderResponse?.c_ccvUrlIntent

    useEffect(() => {
        startOrderStatusPolling(orderResponse?.orderNo)
    }, [])

    return (
        <>
            <Modal
                isOpen={isBancontactModalOpen}
                onClose={onBancontactModalClose}
                closeOnOverlayClick={false}
            >
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>
                        <Box {...styles.headerMsg}>
                            <Box>
                                <FormattedMessage
                                    defaultMessage="Bancontact payment"
                                    id="ccv.bancontact_modal.title"
                                />
                            </Box>
                            <BanContactIcon {...styles.bancontactIcon} />
                        </Box>
                    </ModalHeader>

                    <ModalBody>
                        {/* ORDER TOTAL */}
                        <Box {...styles.orderTotal}>
                            <Text>
                                <FormattedMessage
                                    defaultMessage="Order total: "
                                    id="ccv.bancontact_modal.order_total"
                                />
                            </Text>
                            <Text>
                                <FormattedNumber
                                    style="currency"
                                    currency={orderResponse.currency}
                                    value={orderResponse.orderTotal}
                                />
                            </Text>
                        </Box>
                        <Divider mb="1.5rem" />

                        <Stack {...styles.stack}>
                            {/* QR CODE */}
                            {qrCode && !isMobile && (
                                <>
                                    <Box {...styles.qrCodeContainer}>
                                        <QRCode value={qrCode} />
                                    </Box>
                                    <Alert status="info">
                                        <AlertIcon />
                                        <FormattedMessage
                                            defaultMessage="Complete the payment by scanning the QR code"
                                            id="ccv.bancontact_modal.info_message.qr_code"
                                        />
                                    </Alert>
                                    <SeparatorMsg />
                                </>
                            )}

                            {/* OPEN BANCONTACT APP CTA */}
                            {urlIntent && isMobile && (
                                <>
                                    <Button href={urlIntent} {...styles.openAppBtn}>
                                        <FormattedMessage
                                            defaultMessage="Pay in the Bancontact app"
                                            id="ccv.bancontact_modal.open_bancontact_app"
                                        />
                                    </Button>
                                    <SeparatorMsg />
                                </>
                            )}

                            {/* REDIRECT TO CCV PAY URL CTA */}
                            {payUrl && (
                                <Button href={payUrl} {...styles.redirectBtn}>
                                    <FormattedMessage
                                        defaultMessage="Enter your card details"
                                        id="ccv.bancontact_modal.enter_card_details"
                                    />
                                </Button>
                            )}
                        </Stack>
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            onClick={cancelPayment}
                            isLoading={isCanceling}
                            {...styles.cancelBtn}
                        >
                            <FormattedMessage
                                defaultMessage="Cancel"
                                id="ccv.bancontact_modal.bancontact_cancel"
                            />
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    )
}

BancontactModal.propTypes = {
    /** Setter for the "Place Order" button loading state */
    setPlaceOrderBtnLoading: PropTypes.func
}

const SeparatorMsg = () => {
    return (
        <Box display="flex" flexDirection="row" w="100%" my="1rem">
            <Divider mt="0.7rem" />
            <Box fontWeight="bold" px="0.8rem">
                <FormattedMessage defaultMessage="Or" id="ccv.bancontact_modal.or" />
            </Box>
            <Divider mt="0.7rem" />
        </Box>
    )
}

export default BancontactModal
