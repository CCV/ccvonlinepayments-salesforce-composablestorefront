import React from 'react'
import {useIntl, FormattedMessage} from 'react-intl'
import {Box, Stack, Container, Button, Heading} from '@chakra-ui/react'
import {Controller} from 'react-hook-form'
import CCRadioGroup from '@salesforce/retail-react-app/app/pages/checkout/partials/cc-radio-group'
import CreditCardFields from '@salesforce/retail-react-app/app/components/forms/credit-card-fields'
import {useCCVPayment} from '../../util/ccv-context'

export const CreditCardInlineOptions = () => {
    const {formatMessage} = useIntl()
    const {form} = useCCVPayment()

    const hideSubmitButton = true

    {
        const {onPaymentIdChange, togglePaymentEdit, isEditingPayment, hasSavedCards} =
            useCCVPayment()
        return (
            <>
                <Box p={[4, 4, 6]} borderBottom="1px solid" borderColor="gray.100">
                    <Stack spacing={6}>
                        {hasSavedCards && (
                            <Controller
                                name="paymentInstrumentId"
                                defaultValue=""
                                control={form.control}
                                rules={{
                                    required: !isEditingPayment
                                        ? formatMessage({
                                              defaultMessage: 'Please select a payment method.',
                                              id: 'payment_selection.message.select_payment_method'
                                          })
                                        : false
                                }}
                                render={({value}) => (
                                    <CCRadioGroup
                                        form={form}
                                        value={value}
                                        isEditingPayment={isEditingPayment}
                                        togglePaymentEdit={togglePaymentEdit}
                                        onPaymentIdChange={onPaymentIdChange}
                                    />
                                )}
                            />
                        )}

                        {(isEditingPayment || !hasSavedCards) && (
                            <Box
                                {...(hasSavedCards && {
                                    px: [4, 4, 6],
                                    py: 6,
                                    rounded: 'base',
                                    border: '1px solid',
                                    borderColor: 'blue.600'
                                })}
                            >
                                <Stack spacing={6}>
                                    {hasSavedCards && (
                                        <Heading as="h3" size="sm">
                                            <FormattedMessage
                                                defaultMessage="Add New Card"
                                                id="payment_selection.heading.add_new_card"
                                            />
                                        </Heading>
                                    )}

                                    <CreditCardFields form={form} />

                                    {!hideSubmitButton && (
                                        <Box>
                                            <Container variant="form">
                                                <Button
                                                    isLoading={form.formState.isSubmitting}
                                                    type="submit"
                                                    w="full"
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Save & Continue"
                                                        id="payment_selection.button.save_and_continue"
                                                    />
                                                </Button>
                                            </Container>
                                        </Box>
                                    )}
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                </Box>
            </>
        )
    }
}
