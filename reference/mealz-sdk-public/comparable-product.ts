/**
 * An interface used to represent a product when Mealz synchronizes the client's cart with
 * Mealz's basket, and need to compare products present in each one.
 */
export interface ComparableProduct {
  /**
   * Id of the product in the client's database (called ext-id on Mealz's end).
   */
  id: string;
  /**
   * When client side sends an array of ComparableProduct to Mealz, the SDK expects quantities
   * to match the quantity of each product in the cart of the client.
   *
   * When Mealz sends an array of ComparableProducts to the client, quantities represent the quantity
   * of products to add to the client's cart, and as such can be negatives if products need to be
   * removed from the cart.
   */
  quantity: number;
  /**
   * The client can add attributes if they need when sending ComparableProducts to the SDK.
   * Mealz will send the attributes back if changes are to be made about those products.
   */
  additionalInfos?: any;
}
