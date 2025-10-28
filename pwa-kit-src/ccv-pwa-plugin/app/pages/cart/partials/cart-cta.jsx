import React, {Fragment} from 'react'
import {FormattedMessage} from 'react-intl'
import {Button} from '@salesforce/retail-react-app/app/components/shared/ui'
import {LockIcon} from '@salesforce/retail-react-app/app/components/icons'
import Link from '@salesforce/retail-react-app/app/components/link'
import IdealFastButton from '../../../components/ideal-fast-button'

const CartCta = () => {
    return (
        <Fragment>
            <Button
                as={Link}
                to="/checkout"
                width={['95%', '95%', '95%', '100%']}
                marginTop={[6, 6, 2, 2]}
                rightIcon={<LockIcon />}
                variant="solid"
            >
                <FormattedMessage
                    defaultMessage="Proceed to Checkout"
                    id="cart_cta.link.checkout"
                />
            </Button>
            <IdealFastButton />
        </Fragment>
    )
}

export default CartCta
