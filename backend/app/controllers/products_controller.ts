import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'
import router from '@adonisjs/core/services/router'
import AgroDealerProfile from '#models/agro_dealer_profile'
import ProductValidator from '#validators/product_validator'
import { DateTime } from 'luxon'

export default class ProductsController {
  /**
   * List products by an agro-dealer.
   *
   * `GET /api/v1/products`
   */
  public async index({ response, auth }: HttpContext) {
    const user = auth.user!
    await user.load('agroDealerProfile') // Middleware ensures the user is an agro-dealer
    const unverified = await this.#checkVerification(user.agroDealerProfile)

    if (unverified) {
      return response.forbidden(unverified)
    }

    await user.agroDealerProfile.load('products', (productsQuery) => {
      productsQuery
        .select(['id', 'name', 'category', 'unit', 'price', 'stock_quantity', 'target_problems'])
        .orderBy('created_at', 'desc')
    })

    return response.ok({
      data: user.agroDealerProfile.products.map((product) => ({
        ...product.serialize(),
        links: {
          view: {
            method: 'GET',
            href: router.makeUrl('api.v1.products.show', [product.id]),
          },
          update: {
            method: 'PUT',
            href: router.makeUrl('api.v1.products.update', [product.id]),
          },
        },
      })),
      links: {
        create: {
          method: 'POST',
          href: router.makeUrl('api.v1.products.store'),
        },
      },
    })
  }

  /**
   * Show product by an agro-dealer.
   *
   * `GET /api/v1/products/:id`
   */
  public async show({ response, auth, params }: HttpContext) {
    const user = auth.user!
    await user.load('agroDealerProfile') // Middleware ensures the user is an agro-dealer
    const unverified = await this.#checkVerification(user.agroDealerProfile)

    if (unverified) {
      return response.forbidden(unverified)
    }

    const product = await this.#getProduct({
      productId: params.id,
      agroDealerProfileId: user.agroDealerProfile?.id,
    })

    if (typeof product === 'string') {
      return response.notFound({
        error: product,
      })
    }

    return response.ok({
      data: {
        ...product.serialize(),
        links: {
          view: {
            method: 'GET',
            href: router.makeUrl('api.v1.products.update', [product.id]),
          },
          update: {
            method: 'PUT',
            href: router.makeUrl('api.v1.products.update', [product.id]),
          },
        },
      },
    })
  }

  /**
   * Create a product by an agro-dealer.
   *
   * `POST /api/v1/products`
   */
  public async store({ request, response, auth }: HttpContext) {
    const user = auth.user!
    await user.load('agroDealerProfile') // Middleware ensures the user is an agro-dealer
    const unverified = await this.#checkVerification(user.agroDealerProfile)

    if (unverified) {
      return response.forbidden(unverified)
    }

    const payload = await request.validate(ProductValidator)

    const product = await Product.create({
      active_ingredient: payload.active_ingredient,
      agro_dealer_profile_id: user.agroDealerProfile!.id,
      category: payload.category,
      description: payload.description,
      name: payload.name,
      price: payload.price.toFixed(2),
      stock_quantity: payload.stock_quantity,
      target_problems: payload.target_problems,
      unit: payload.unit,
    })

    return response.created({
      message: 'Product created successfully.',
      data: {
        ...product,
        links: {
          view: {
            method: 'GET',
            href: router.makeUrl('api.v1.products.show', [product.id]),
          },
          update: {
            method: 'PUT',
            href: router.makeUrl('api.v1.products.update', [product.id]),
          },
        },
      },
    })
  }

  /**
   * Update product by an agro-dealer.
   *
   * `PUT /api/v1/products/:id`
   */
  public async update({ response, auth, params, request }: HttpContext) {
    const user = auth.user!
    await user.load('agroDealerProfile') // Middleware ensures the user is an agro-dealer
    const unverified = await this.#checkVerification(user.agroDealerProfile)

    if (unverified) {
      return response.forbidden(unverified)
    }

    const product = await this.#getProduct({
      productId: params.id,
      agroDealerProfileId: user.agroDealerProfile?.id,
    })

    if (typeof product === 'string') {
      return response.notFound({
        error: product,
      })
    }

    const payload = await request.validate(ProductValidator)

    await product
      .merge({
        ...payload,
        price: payload.price.toFixed(2),
        updated_at: DateTime.now(),
      })
      .save()

    await product.refresh()

    return response.ok({
      message: 'Product updated successfully.',
      data: {
        ...product.serialize(),
        links: {
          view: {
            method: 'GET',
            href: router.makeUrl('api.v1.products.show', [product.id]),
          },
          update: {
            method: 'PUT',
            href: router.makeUrl('api.v1.products.update', [product.id]),
          },
        },
      },
    })
  }

  async #checkVerification(agroDealerProfile: AgroDealerProfile) {
    if (!agroDealerProfile.is_verified) {
      return {
        error: 'You cannot perform this action until you complete verification.',
      }
    }
  }

  async #getProduct({
    productId,
    agroDealerProfileId,
  }: {
    productId: string
    agroDealerProfileId: string
  }) {
    const product = await Product.query()
      .select([
        'id',
        'name',
        'category',
        'unit',
        'price',
        'stock_quantity',
        'target_problems',
        'active_ingredient',
        'description',
        'created_at',
        'updated_at',
      ])
      .where({ id: productId, agro_dealer_profile_id: agroDealerProfileId })
      .first()

    if (!product) {
      return 'Product not found.'
    }

    return product
  }
}
