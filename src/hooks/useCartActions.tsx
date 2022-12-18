import { type Cart, type Product } from "@prisma/client";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useState, createContext, type ReactNode, useContext } from "react";
import { CartMenu } from "../components/CartMenu";
import { type CartItem } from "../types/cart";
import getStripe from "../utils/get-stripejs";
import { tranformCartItems } from "../utils/helpers";
import { toast } from "react-toastify";
import { trpc } from "../utils/trpc";

type CartProviderProps = {
  children: ReactNode;
};
type CartContext = {
  toggleCart: () => void;
};

export const useCartActions = () => {
  const utils = trpc.useContext();
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id || "hi";
  const cartUser = trpc.cart.getUserCart.useQuery(undefined, {
    enabled: false,
  });
  const addToCart = trpc.cart.addItem.useMutation({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    async onMutate(el: { userId: string; item: Product; quantity: number }) {
      await utils.cart.getCartItems.cancel();
      const prevData = utils.cart.getCartItems.getData();
      if (!prevData) return;
      const existing = prevData?.find((data) => {
        return data.product.id === el.item.id;
      });

      console.log(existing);
      if (existing) {
        existing.quantity++;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        utils.cart.getCartItems.setData(undefined, (old) => [...old]);

        return { prevData };
      }
      const newItem = {
        id: (Math.random() + 1).toString(36).substring(7),
        product: el.item,
        productId: el.item.id,
        quantity: el.quantity,
        cart: cartUser.data,
        cartId: cartUser?.data?.id,
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      utils.cart.getCartItems.setData(undefined, (old) => [...old, newItem]);
      return { prevData };
    },
    onError(err, newPost, ctx) {
      // If the mutation fails, use the context-value from onMutate
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      utils.cart.getCartItems.setData(undefined, ctx.prevData);
    },
    onSettled() {
      utils.cart.getCartItems.invalidate();
    },
  });

  const removeFromCart = trpc.cart.removeItem.useMutation({
    async onMutate(id: string) {
      await utils.cart.getCartItems.cancel();
      const prevData = utils.cart.getCartItems.getData();
      const newItems = prevData?.filter((item) => item.id !== id);
      utils.cart.getCartItems.setData(undefined, () => newItems);
      return { prevData };
    },
    onError(err, newPost, ctx) {
      utils.cart.getCartItems.setData(undefined, ctx?.prevData);
    },
    onSettled() {
      utils.cart.getCartItems.invalidate();
    },
  });
  const removeOne = trpc.cart.removeOne.useMutation({
    async onMutate(el: CartItem) {
      await utils.cart.getCartItems.cancel();
      const prevData = utils.cart.getCartItems.getData();
      prevData?.forEach((item) => {
        if (item.id === el.id) {
          item.quantity--;
        }
      });

      utils.cart.getCartItems.setData(undefined, () => prevData);
      return { prevData };
    },
    onError(err, newPost, ctx) {
      utils.cart.getCartItems.setData(undefined, ctx?.prevData);
    },
    onSettled() {
      utils.cart.getCartItems.invalidate();
    },
  });

  const removeCart = trpc.cart.removeCart.useMutation({
    async onMutate() {
      await utils.cart.getCartItems.cancel();
      const prevData = utils.cart.getCartItems.getData();
      utils.cart.getCartItems.setData(undefined, () => []);
      return { prevData };
    },
    onError(err, newPost, ctx) {
      utils.cart.getCartItems.setData(undefined, ctx?.prevData);
    },
    onSettled() {
      utils.cart.getCartItems.invalidate();
    },
    onSuccess() {
      utils.cart.getUserCart.refetch();
    },
  });

  const clearCart = () => {
    return removeCart.mutate(userId);
  };

  const addToCartHandler = (el: Product, quantity: number) => {
    console.log(el);
    toast.success("Added to cart");
    return addToCart.mutate({ userId, item: el, quantity });
  };

  const removeItem = (id: string) => {
    return removeFromCart.mutate(id);
  };

  const deleteOne = (el: CartItem) => {
    if (el.quantity === 1) {
      return removeFromCart.mutate(el.id);
    }
    if (el.quantity > 1) {
      return removeOne.mutate(el);
    }
  };
  const createCheckOutSession = async (
    cartItems:
      | {
          cart: Cart;
          product: Product;
          id: string;
          quantity: number;
          cartId: string;
        }[]
      | undefined
  ) => {
    const stripe = await getStripe();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const transformedItems = tranformCartItems(cartItems);

    const checkoutSession = await axios.post(
      "/api/checkout_sessions",
      transformedItems
    );

    const result = await stripe?.redirectToCheckout({
      sessionId: checkoutSession.data.id,
    });

    if (result?.error) {
      alert(result?.error.message);
    }
  };

  return {
    addToCartHandler,
    removeItem,
    deleteOne,
    clearCart,
    createCheckOutSession,
  };
};
const CartContext = createContext({} as CartContext);

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }: CartProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleCart = () => setIsOpen((prev) => !prev);

  return (
    <CartContext.Provider value={{ toggleCart }}>
      {children}
      <CartMenu isOpen={isOpen} />
    </CartContext.Provider>
  );
}
