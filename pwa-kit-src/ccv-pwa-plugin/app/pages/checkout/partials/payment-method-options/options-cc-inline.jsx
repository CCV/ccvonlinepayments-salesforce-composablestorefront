import React from 'react'
import {FormattedMessage} from 'react-intl'
import {Box, Stack, Container, Button} from '@chakra-ui/react'
import CreditCardFields from '@salesforce/retail-react-app/app/components/forms/credit-card-fields'
import {useCCVPayment} from '../../util/ccv-context'

export const CreditCardInlineOptions = () => {
    const {form} = useCCVPayment()

    const hideSubmitButton = true

    return (
        <Box p={[4, 4, 6]} borderBottom="1px solid" borderColor="gray.100">
            <Stack spacing={6}>
                <Box>
                    <Stack spacing={6}>
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
            </Stack>
        </Box>
    )
}
