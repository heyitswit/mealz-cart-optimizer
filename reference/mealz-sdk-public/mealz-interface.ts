import { EventEmitter } from '@angular/core';
import { DocumentCollection } from 'miam-jsonapi';
import { Observable } from 'rxjs';
import { PointOfSale, Supplier } from '../../_models';
import {
  AttachRecipeCardShowTrackingOptions,
  RecipeCardShowTrackingHandle
} from '../../_utils/attach-recipe-card-show-tracking';
import {
  AttachProductShowTrackingOptions,
  ProductShowTrackingHandle
} from '../../_utils/attach-product-show-tracking';
import { ComparableProduct } from './comparable-product';

export interface MealzInterface {
  /**
   * Method to call when the user begins the payment procedure (typically when they click
   * on a "Confirm my cart" button)
   * @param totalPrice the total price of your basket (can be a floating or integer number)
   */
  paymentStarted: (totalPrice: number) => void;

  // ---------------------------------------------------------------------------------------------------

  analytics: {
    /**
     * Initialize Analytics
     *
     * @param domain Plausible domain
     */
    init: (domain: string) => void;

    /**
     * Observable on events as a string sent from Analytics
     */
    eventSent$: Observable<string>;

    /**
     * Must be called before init
     */
    setAbTestKey: (key: string) => void;

    /**
     * Attach viewport-based `recipe.show` tracking on a custom recipe card root element.
     * Same behaviour as the native `mealz-recipe-card` (80% visible for 1s, deduped after scroll).
     * Call the returned handle's `disconnect()` when the element is removed.
     */
    attachRecipeCardShowTracking: (
      options: AttachRecipeCardShowTrackingOptions
    ) => RecipeCardShowTrackingHandle;

    /**
     * Attach viewport-based `product.show` tracking on a recipe details product card root element.
     * Same behaviour as `mealz-product-card` (80% visible for 1s, deduped per recipe/item).
     * Call the returned handle's `disconnect()` when the element is removed.
     */
    attachProductShowTracking: (
      options: AttachProductShowTrackingOptions
    ) => ProductShowTrackingHandle;
  };

  // ---------------------------------------------------------------------------------------------------

  basket: {
    /**
     * Emits true when Mealz's basket has succesfully loaded for the first time.
     * Does not emit anything before or after that.
     */
    basketIsReady$: Observable<boolean>;
    /**
     * Fetch the first Basket early (before any action requires it on Mealz's
     * side), so you can start the basket-sync earlier
     */
    initialize: () => void;
    /**
     * Resets Mealz's basket : empties all products & recipes added by the user
     * /!\ We heavily recommend not to use this method except in the console for testing purposes /!\
     */
    reset: () => void;
    /**
     * @returns A BehaviorSubject that emits the current number of recipes in Mealz's Basket
     */
    recipeCount: () => Observable<number>;
    /**
     * @returns A BehaviorSubject that emits the current number of active products in Mealz's Basket
     */
    productCount: () => Observable<number>;
    /**
     * Opens the preview by calling the `openBasket` method of the `recipesService`.
     * @param analyticsPath The path to the analytics event
     * @param selectedTab The tab to select in the preview
     */
    openPreview: (analyticsPath?: string, selectedTab?: number) => void;
    /**
     * /!\ Debug only: If no-supplier mode is activated, override the base of the transfer url with an other url
     * ex: if transfer url is 'https://test.com/recipes?param1=x,param2=y'
     * and overrideTransferUrl is called with 'http://localhost:3000/recettes'
     * transfer url will become 'http://localhost:3000/recettes?param1=x,param2=y'
     */
    overrideTransferUrl: (url: string) => void;
  };

  basketSync: {
    /**
     * The callback parameter is called when Mealz's basket changes to update the user's cart accordingly
     *
     * @param pushProductsToCart a method that updates the user's cart with the products passed in parameter, by adding
     * products if their quantity is positive, and removing them if their quantity is negative
     */
    definePushProductsToCart: (pushProductsToCart: (products: ComparableProduct[]) => void) => void;
    /**
     * The callback parameter is called when Mealz's basket adds new products to update the user's cart accordingly
     *
     * @param pushProductsToCart a method that adds the products passed in parameter to the user's cart
     */
    defineAddProductsToCart: (addProductsToCart: (products: ComparableProduct[]) => void) => void;
    /**
     * The callback parameter is called when Mealz's basket removes some products to update the user's cart accordingly
     *
     * @param pushProductsToCart a method that removes the products passed in parameter from the user's cart (the quantity attribute of
     * each product is a negative number to indicate that it is the quantity to remove)
     */
    defineRemoveProductsFromCart: (removeProductsFromCart: (products: ComparableProduct[]) => void) => void;
    /**
     * The callback parameter is called when Mealz's basket changes to update the user's cart accordingly
     *
     * @param pushProductsToCart a method that updates the user's cart with the pruducts passed in parameter, by adding
     * products if their quantity is positive, and removing them if their quantity is negative
     */
    definePushBasketEntriesToBasket: (pushProductsToCart: (products: ComparableProduct[]) => void) => void;
    /**
     * Call to notify Mealz that the user's cart has been updated
     *
     * @param comparableProducts The products in the user's cart
     */
    retailerBasketChanged: (comparableProducts: ComparableProduct[]) => void;
    /**
     * Call to notify Mealz that the user's cart was paid
     * Mealz then refreshes the basket for the next user's cart
     *
     * @param total The total price of the cart paid
     */
    handlePayment: (total: number) => void;
  };

  // ---------------------------------------------------------------------------------------------------

  config: {
    mealzLogs: (param: 'none' | 'warn' | 'error' | 'all') => void;
  };

  // ---------------------------------------------------------------------------------------------------

  features: {
    /**
     * Call to enable recipes to display a video instead of their picture, if there is a video for the recipe
     */
    enableVideoRecipes: () => void;
    /**
     * Call to authorize Mealz to ask for user preferences the first time users view the recipe catalog
     */
    enableUserPreferences: () => void;
    /**
     * Call to enable tags displaying on recipe-details
     */
    enableTagsOnRecipes: () => void;
    /**
     * Call to enable the meals-planner
     *
     * @param url of the page where you inject the meals planner
     * @param antiInflation if you want to use the anti inflation
     */
    enableMealsPlanner: (url: string, antiInflation?: boolean) => void;

    /**
     * Call to enable SEO (Title and meta tags on recipe display)
     */
    enableSeo: () => void;

    /**
     * Call to enable collapsing of unavailable products by default
     * @deprecated Not used anymore
     */
    collapseUnavailableProductsByDefault: () => void;
  };

  // ---------------------------------------------------------------------------------------------------

  hook: {
    /**
     * Set up a callback which Mealz will call before adding a recipe to the user's cart
     *
     * @param callback a method that will be called passing two parameters :
     *  - isLogged, true if the user is logged (according to Mealz, see user.loadWithExtId for more)
     *  - isPosValid true if the PointOfSale is recognized by Mealz
     * Typically you might want to use this to show your connexion page if the user tries to add a recipe while logged out
     * or to show your point of sale picker if the user has not chosen one
     */
    setHookCallback: (callback: (isLogged, isPosValid) => boolean) => void;
    /**
     * Set up a callback which Mealz will call when it needs to force the POS
     * (only used when tranfering a basket from an affiliated website)
     *
     * @param callback a method that will be called passing :
     *  - posExtId, the id of the POS (in your database)
     */
    setForcePosCallback: (callback: (posExtId: string) => boolean) => void;
  };

  // ---------------------------------------------------------------------------------------------------

  pos: {
    /**
     * Call to inform Mealz of the point of sale the user is currently on. Do not forget to call the method
     * if it changes after user loads the page
     *
     * @param externalId the id of the PointOfSale in client's database
     */
    load: (externalId) => void;

    /**
     * This is an internal method that will be moved elsewhere soon. Do not call
     */
    getByAddress: (address: string, radius: string, suppliers: string[]) => Observable<DocumentCollection<PointOfSale>>;
    /**
     * This is an internal method that will be moved elsewhere soon. Do not call
     */
    getByCoordinates: (latitude: number, longitude: number, radius: number, suppliers: string[]) => Observable<DocumentCollection<PointOfSale>>;

  };

  // ---------------------------------------------------------------------------------------------------

  recipes: {
    /**
     * An observable that emits a value when the recipe-modal is closed
     */
    hidden: Observable<boolean>;
    /**
     * An EventEmitter that emits a value when the "Add all ingredients" CTA on recipe-details is clicked
     */
    addAllIngredientsCTAWasClicked: EventEmitter<{ ingredientsAdded: number; ingredientsTotal: number }>;
    /**
     * Call with an url of a picture to change the default picture displayed if an ingredient doesn't have a picture
     * and if ingredients picture have been enabled with recipes.shouldDisplayIngredientPicturesOnRecipeCards(true)
     */
    setDefaultIngredientPicture: (url: string) => void;

    /**
     * Call with an url of a picture to change the default picture displayed if a recipe doesn't have a picture
     */
    setDefaultRecipePicture: (url: string) => void;

    /**
     * Override default labels for difficulty levels
     *
     * @param levels The list of labels to override for each difficulty (difficulties are respectively 1: Easy, 2: Medium, 3: Hard)
     * example : [{value: 1, label: "Beginner"}] to update the label of easy recipes to "Beginner"
     */
    setDifficultyLevels: (levels: { value: number; label: string }[]) => void;
    // /**
    //  * /!\ DEPRECATED: DO NOT USE /!\
    //  */
    //  setRecipesPrimaryButtonActions: (display: boolean, addToBasket: boolean) => void;
    // /**
    //  * /!\ DEPRECATED: DO NOT USE /!\
    //  */
    // setSuggestionsPrimaryButtonActions: (display: boolean, addToBasket: boolean) => void;
    /**
     * If called, adding or removing any product to or from the cart will display a confirmation toaster
     */
    showConfirmationToaster: () => void;

    /**
     * @param should if set to true, the recipe-cards will display the ingredients of their recipe
     */
    shouldDisplayIngredientPicturesOnRecipeCards: (should: boolean) => void;
  };

  // ---------------------------------------------------------------------------------------------------

  router: {
    /**
     * Inform Mealz of the url where the catalog is for the redirection link of recipe-details
     */
    setRecipeCatalogUrl: (url?: string) => void;
    /**
     * Inform Mealz of the url where the onboarding section of the catalog should redirect
     */
    setRecipeInfoLink: (url?: string) => void;
    /**
     * Inform Mealz of the url of the retailer's if Mealz needs to redirect there
     */
    setRetailerCartUrl: (url?: string) => void;
    /**
     * Inform Mealz of the url where the promotions are
     */
    setPromotionsUrl: (url?: string) => void;
  };

  // ---------------------------------------------------------------------------------------------------

  supplier: {
    /**
     * /!\ This needs to be the first method called, because nothing will work if the origin isn't set
     * @param origin an identifier string that Mealz passes to the API with each request to keep track of the origin
     * of the request
     */
    setOrigin: (origin: string) => void;
    /**
     * Call to inform Mealz of the supplier the user is currently on. Do not forget to call the method
     * if it changes after user loads the page (should not happen escept in very specific cases)
     *
     * @param supplierId the Supplier id in Mealz's database
     */
    load: (supplierId: number | string) => void;
    /**
     * 3-in-1 version of supplier.load, supplier.setOrigin & analytics.init, that requires a single token
     * @param token a single token containing the information for supplierId, origin & plausible domain
     */
    setupWithToken: (token: string) => void;

    getAffiliateSuppliers: () => Observable<Supplier[]>;
  };

  // ---------------------------------------------------------------------------------------------------

  user: {
    /**
     * Call to inform Mealz of the id of the user.
     *
     * @param id a string unique identifier to the user
     * @param forbidProfiling if set to true, desactivate personalized content (personalized recipes & products)
     * @param initBasket DEPRECATED - if set to true, fetch the GroceriesList & Basket of the user (recommanded as
     * it saves time later)
     */
    loadWithExternalId: (id: string, forbidProfiling?: boolean, initBasket?: boolean) => Observable<object>;
    /**
     * Call to inform Mealz that the user is authless with the corresponding id
     * @param id authless-id fetched from the route /generate-authless-token
     * @param forbidProfiling if set to true, desactivate personalized content (personalized recipes & products)
     */
    loadWithAuthlessId: (id: string, forbidProfiling?: boolean) => void;
    /**
     * Call to inform Mealz that profiling preferences have been updated
     * @param forbidProfiling if set to true, desactivate personalized content (personalized recipes & products)
     * @param userId userId or authlessId of the user
     * @param isAuthless if true Mealz will treat userID as an authless-id
     */
    updateForbidProfiling: (forbidProfiling: boolean, userId: string, isAuthless: boolean) => void;
    /**
     * Call to inform Mealz that the user has logged out
     */
    reset: () => void;

    /**
     * Set user language with a ISO 639-1 code or custom language name
     * @param lang
     */
    setLanguage: (lang: string) => void;

    /**
     * If your website has a "favorite products" feature, you can pass the ids of all products
     * which the user has marked as favorites, so they can be prioritized when adding a recipe
     * to their cart, if one of them is returned as a matching product for the recipe.
     *
     * @param favoriteProductIds an array of product ids, passed as string
     */
    setFavoriteItems: (favoriteProductIds: string[]) => Observable<object>;

    /**
     * User location can be set from the user's browser if they allowed it
     * @param coords must provide latitude (number) and longitude (number) and optionally an accuracy (number)
     */
    setLocation: (coords: GeolocationPosition) => void;
  };

  // ---------------------------------------------------------------------------------------------------

  events: {
    storeLocatorOpened: () => Observable<boolean>
  };

  /**
   * Call with the height in px of your website's header when it is sticky so Mealz can offset its sticky components
   * If not called, any sticky components from Mealz may appear not stick correctly below your header
   */
  setStickyHeaderHeight: (height: number) => void;

  // ---------------------------------------------------------------------------------------------------

  /**
   * Override two times will not be considered (DEPRECATED)
   * @param icon have to be a knowed icon name see section 'Custom icons' in read me
   * @param url of the new icon
   */
  overrideIcon: (icon, url: string) => void;

  /**
   * Pass a callback that returns the default scroll container of the page so mealz modal can block the scroll when opened
   * Default callback returns document.body
   */
  setDefaultScrollElementGetter: (callback: () => HTMLElement) => void;
}
