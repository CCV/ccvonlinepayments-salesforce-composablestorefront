/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React from 'react'
import PropTypes from 'prop-types'
import {FormattedMessage} from 'react-intl'
import {Box, Button, Stack, Text, SimpleGrid, FormControl, FormErrorMessage} from '@chakra-ui/react'
import {useCheckout} from '../../../../app/pages/checkout/util/checkout-context'
import {RadioCard, RadioCardGroup} from '../../../../app/components/radio-card'
import {getCreditCardIcon} from '../../../../app/utils/cc-utils'

const CCRadioGroupCCV = ({form, value = '', onPaymentIdChange = () => null}) => {
    const {customer} = useCheckout()

    return (
        <FormControl
            id="paymentInstrumentId"
            isInvalid={form.errors.paymentInstrumentId}
            isRequired={true}
        >
            {form.errors.paymentInstrumentId && (
                <FormErrorMessage marginTop={0} marginBottom={4}>
                    {form.errors.paymentInstrumentId.message}
                </FormErrorMessage>
            )}

            <RadioCardGroup value={value} onChange={onPaymentIdChange}>
                <Stack spacing={4}>
                    <SimpleGrid columns={[1, 1, 2]} spacing={4}>
                        {customer.paymentInstruments
                            ?.filter((card) => !!card.c_ccvVaultAccessToken)
                            .map((payment) => {
                                const CardIcon = getCreditCardIcon(payment.paymentCard?.cardType)
                                return (
                                    <RadioCard
                                        key={payment.paymentInstrumentId}
                                        value={payment.paymentInstrumentId}
                                    >
                                        <Stack direction="row">
                                            {CardIcon && <CardIcon layerStyle="ccIcon" />}
                                            <Stack spacing={4}>
                                                <Stack spacing={1}>
                                                    <Text>{payment.paymentCard?.cardType}</Text>
                                                    <Stack direction="row">
                                                        <Text>
                                                            &bull;&bull;&bull;&bull;{' '}
                                                            {payment.paymentCard?.numberLastDigits}
                                                        </Text>
                                                        <Text>
                                                            {payment.paymentCard?.expirationMonth}/
                                                            {payment.paymentCard?.expirationYear}
                                                        </Text>
                                                    </Stack>
                                                    <Text>{payment.paymentCard.holder}</Text>
                                                </Stack>

                                                <Box>
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        colorScheme="red"
                                                        onClick={() =>
                                                            customer.removeSavedPaymentInstrument(
                                                                payment.paymentInstrumentId
                                                            )
                                                        }
                                                    >
                                                        <FormattedMessage
                                                            defaultMessage="Remove"
                                                            id="cc_radio_group.action.remove"
                                                        />
                                                    </Button>
                                                </Box>
                                            </Stack>
                                        </Stack>
                                    </RadioCard>
                                )
                            })}

                        <RadioCard value="new_card">
                            <Stack direction="row" py="40px" justify="center">
                                <Stack spacing={4}>
                                    <FormattedMessage
                                        defaultMessage="Add New Card"
                                        id="cc_radio_group.button.add_new_card"
                                    />
                                </Stack>
                            </Stack>
                        </RadioCard>
                    </SimpleGrid>
                </Stack>
            </RadioCardGroup>
        </FormControl>
    )
}

CCRadioGroupCCV.propTypes = {
    /** The form object returned from `useForm` */
    form: PropTypes.object.isRequired,

    /** The current payment ID value */
    value: PropTypes.string,

    /** Flag for payment add/edit form, used for setting validation rules */
    isEditingPayment: PropTypes.bool,

    /** Method for toggling the payment add/edit form */
    togglePaymentEdit: PropTypes.func,

    /** Callback for notifying on value change */
    onPaymentIdChange: PropTypes.func
}

export default CCRadioGroupCCV