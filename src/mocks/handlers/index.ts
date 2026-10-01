import { accountHandlers } from './account'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { favoritesHandlers } from './favorites'
import { nftHandlers } from './nfts'
import { orderHandlers } from './orders'

export const restHandlers = [...authHandlers, ...nftHandlers, ...favoritesHandlers, ...cartHandlers, ...orderHandlers, ...accountHandlers]
