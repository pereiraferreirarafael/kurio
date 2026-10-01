import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/checkout/order-page'

export const Route = createFileRoute('/_authed/orders/$orderId')({
  component: function OrderRoute() {
    const { orderId } = Route.useParams()
    return <OrderPage orderId={orderId} />
  },
})
