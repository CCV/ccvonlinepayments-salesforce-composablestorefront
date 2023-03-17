/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useRef, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import PropTypes from 'prop-types'
import {
    Box,
    Button,
    Container,
    Heading,
    Radio,
    RadioGroup,
    Select,
    Stack,
    FormErrorMessage,
    FormControl,
    Skeleton,
    Spacer
} from '@chakra-ui/react'
import {useForm, Controller} from 'react-hook-form'
import {useCheckout} from '../util/checkout-context'
import CreditCardFields from '../../../components/forms/credit-card-fields'
import CCRadioGroup from './cc-radio-group'
import {PaymentMethodIcons} from '../util/ccv-utils/ccv-utils'
import Field from '../../../components/field'
import {useCCVPayment} from '../util/ccv-utils/ccv-context'

const PaymentSelection = ({form}) => {
    const {formatMessage} = useIntl()
    const {paymentMethods} = useCheckout()

    const paymentFormRef = useRef()
    form = form || useForm()

    const {currentSelectedMethodId, setCurrentSelectedMethodId, onPaymentMethodChange} =
        useCCVPayment()

    useEffect(() => {
        // reset currentSelectedMethod on first load
        setCurrentSelectedMethodId(null)
    }, [])

    // focus form on error
    useEffect(() => {
        if (Object.keys(form.errors).length > 0) {
            paymentFormRef.current.scrollIntoView({behavior: 'smooth', block: 'start'})
        }
    }, [form.errors])

    const test = (e) => {
        e.preventDefault()
        console.log(form.getValues())
        console.log(form)
        console.log(currentSelectedMethodId)
    }

    return (
        <form>
            <FormControl
                id="paymentMethodId"
                isInvalid={form.errors.paymentMethodId}
                ref={paymentFormRef}
            >
                <FormErrorMessage marginTop={0} marginBottom={4}>
                    {form.errors.paymentMethodId?.message}
                </FormErrorMessage>
                <Stack spacing={5}>
                    <Box overflow="hidden">
                        <Controller
                            name="paymentMethodId"
                            defaultValue=""
                            control={form.control}
                            render={({onChange}) => (
                                <RadioGroup
                                    onChange={(e) => {
                                        console.log(e)
                                        onChange(e)
                                        onPaymentMethodChange(e)
                                    }}
                                >
                                    {/* dynamic payment methods */}
                                    <Stack gap={1}>
                                        {paymentMethods ? (
                                            paymentMethods.applicablePaymentMethods.map(
                                                (paymentMethod) => {
                                                    return (
                                                        <CCVPaymentMethodRadio
                                                            key={paymentMethod.id}
                                                            paymentMethod={paymentMethod}
                                                            currentSelectedMethodId={
                                                                currentSelectedMethodId
                                                            }
                                                        />
                                                    )
                                                }
                                            )
                                        ) : (
                                            <Stack>
                                                <Skeleton height="56px" />
                                                <Skeleton height="56px" />
                                                <Skeleton height="56px" />
                                            </Stack>
                                        )}
                                    </Stack>
                                </RadioGroup>
                            )}
                            rules={{
                                required: formatMessage({
                                    defaultMessage: 'Please select a payment method.',
                                    id: 'payment_selection.message.select_payment_method'
                                })
                            }}
                        />
                        <button onClick={test}>test</button>
                    </Box>
                </Stack>
            </FormControl>
        </form>
    )
}

PaymentSelection.propTypes = {
    /** The form object returnd from `useForm` */
    form: PropTypes.object
}

const CCVPaymentMethodRadio = function ({paymentMethod, currentSelectedMethodId}) {
    return (
        <Box border="1px solid" borderColor="gray.100" rounded="base">
            {/* payment method heading row */}
            <Box bg="gray.50" py={3} px={[4, 4, 6]}>
                <Radio value={paymentMethod.id} alignItems="center">
                    <Stack direction="row" align="center">
                        <Box>{paymentMethod.name}</Box>
                        <Spacer />
                        <PaymentMethodIcons paymentMethodId={paymentMethod.id} iconHeight="30px" />
                    </Stack>
                </Radio>
            </Box>
            {currentSelectedMethodId === paymentMethod.id && (
                <CCVMethodOptions paymentMethodId={currentSelectedMethodId} />
            )}
        </Box>
    )
}

const CCVMethodOptions = function ({paymentMethodId}) {
    const {formatMessage} = useIntl()
    const {form, paymentMethodsMap} = useCCVPayment()
    const selectedMethodData = paymentMethodsMap[paymentMethodId]
    const hideSubmitButton = true

    switch (paymentMethodId) {
        case 'CCV_IDEAL': {
            const options = JSON.parse(selectedMethodData.c_ccvOptions)

            const countryGroups = {}
            options.forEach((option) => {
                if (!countryGroups[option.group]) {
                    countryGroups[option.group] = [option]
                } else countryGroups[option.group].push(option)
            })

            return (
                <FormControl id="ccvIssuerID" isInvalid={form.errors.ccvIssuerID} padding="20px">
                    <Controller
                        as={Select}
                        name="ccvIssuerID"
                        defaultValue=""
                        control={form.control}
                        rules={{
                            required: formatMessage({
                                defaultMessage: 'Please select an option.',
                                id: 'payment_selection.message.select_payment_method_option'
                            })
                        }}
                    >
                        <option value="">
                            {formatMessage({
                                defaultMessage: 'Select your bank.',
                                id: 'payment_selection.message.select_bank'
                            })}
                        </option>
                        {Object.keys(countryGroups).map((countryGroup) => {
                            return (
                                <optgroup label={countryGroup} key={countryGroup}>
                                    {countryGroups[countryGroup].map((issuer) => {
                                        return (
                                            <option value={issuer.issuerid} key={issuer.issuerid}>
                                                {issuer.issuerdescription}
                                            </option>
                                        )
                                    })}
                                </optgroup>
                            )
                        })}
                    </Controller>
                    <FormErrorMessage marginTop={0} marginBottom={4}>
                        {form.errors.ccvIssuerID?.message}
                    </FormErrorMessage>
                </FormControl>
            )
        }

        case 'CCV_GIROPAY': {
            const options = JSON.parse(selectedMethodData.c_ccvOptions || '[]')
            const selectOptions = options.map((option) => {
                return {value: option.issuerid, label: option.issuerdescription}
            })

            const issuerField = {
                name: `ccvIssuerID`,
                defaultValue: '',
                type: 'select',
                options: [
                    {
                        value: '',
                        label: formatMessage({
                            defaultMessage: 'Select your bank.',
                            id: 'payment_selection.message.select_bank'
                        })
                    },
                    ...selectOptions
                ],
                rules: {
                    required: formatMessage({
                        defaultMessage: 'Please select an option.',
                        id: 'payment_selection.message.select_payment_method_option'
                    })
                },
                error: form.errors.ccvIssuerID,
                control: form.control
            }

            return (
                <Box padding="20px">
                    <Field {...issuerField} />
                </Box>
            )
        }

        case 'CCV_CREDIT_CARD': {
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

        default:
            return <input type="hidden" {...form.register('ccvIssuerID')} defaultValue="" />
    }
}

CCVMethodOptions.propTypes = {
    /** Currently selected payment method ID */
    paymentMethodId: PropTypes.string
}

CCVPaymentMethodRadio.propTypes = {
    /** Currently selected payment method ID */
    paymentMethod: PropTypes.object,
    currentSelectedMethodId: PropTypes.string
}

export default PaymentSelection
