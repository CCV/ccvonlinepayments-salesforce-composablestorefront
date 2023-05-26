import React from 'react'
import {useIntl} from 'react-intl'
import {FormControl, Select, FormErrorMessage} from '@chakra-ui/react'
import {Controller} from 'react-hook-form'

import {useCCVPayment} from '../../util/ccv-context'

export const IdealOptions = () => {
    const {formatMessage} = useIntl()
    const {form, paymentMethodsMap} = useCCVPayment()
    const selectedMethodData = paymentMethodsMap['CCV_IDEAL']

    const options = selectedMethodData?.c_ccvOptions || []

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
                data-testid="options-ideal"
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
            <FormErrorMessage>{form.errors.ccvIssuerID?.message}</FormErrorMessage>
        </FormControl>
    )
}
