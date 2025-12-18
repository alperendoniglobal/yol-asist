import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';

export class IyzicoService {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.iyzico.apiKey;
    this.secretKey = config.iyzico.secretKey;
    this.baseUrl = config.iyzico.baseUrl;
  }

  /**
   * Create payment request hash
   */
  private createHash(data: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(data)
      .digest('base64');
  }

  /**
   * Process payment with Iyzico
   */
  async processPayment(paymentData: {
    price: number;
    currency: string;
    conversationId: string;
    buyer: {
      id: string;
      name: string;
      surname: string;
      email: string;
      phone: string;
    };
    shippingAddress: {
      contactName: string;
      city: string;
      country: string;
      address: string;
    };
    billingAddress: {
      contactName: string;
      city: string;
      country: string;
      address: string;
    };
    basketItems: Array<{
      id: string;
      name: string;
      category1: string;
      itemType: string;
      price: number;
    }>;
    paymentCard: {
      cardHolderName: string;
      cardNumber: string;
      expireMonth: string;
      expireYear: string;
      cvc: string;
    };
    installment?: number;
  }) {
    try {
      // If Iyzico credentials are not configured, return mock response
      if (!this.apiKey || !this.secretKey || this.apiKey === '' || this.secretKey === '') {
        return this.mockPaymentResponse(paymentData);
      }

      const requestData = {
        locale: 'tr',
        conversationId: paymentData.conversationId,
        price: paymentData.price.toString(),
        paidPrice: paymentData.price.toString(),
        currency: paymentData.currency,
        installment: paymentData.installment || '1',
        paymentCard: paymentData.paymentCard,
        buyer: paymentData.buyer,
        shippingAddress: paymentData.shippingAddress,
        billingAddress: paymentData.billingAddress,
        basketItems: paymentData.basketItems,
      };

      const requestString = JSON.stringify(requestData);
      const hash = this.createHash(requestString);

      const response = await axios.post(
        `${this.baseUrl}/payment/auth`,
        requestData,
        {
          headers: {
            'Authorization': `IYZWS ${this.apiKey}:${hash}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        status: response.data.status === 'success' ? 'success' : 'failure',
        paymentId: response.data.paymentId,
        conversationId: response.data.conversationId,
        price: response.data.price,
        paidPrice: response.data.paidPrice,
        currency: response.data.currency,
        installment: response.data.installment,
        fraudStatus: response.data.fraudStatus,
        paymentStatus: response.data.paymentStatus,
        errorCode: response.data.errorCode,
        errorMessage: response.data.errorMessage,
        rawResponse: response.data,
      };
    } catch (error: any) {
      console.error('Iyzico payment error:', error);
      throw new Error(
        error.response?.data?.errorMessage || 'Iyzico payment failed'
      );
    }
  }

  /**
   * Mock payment response for development/testing
   */
  private mockPaymentResponse(paymentData: any) {
    return {
      status: 'success',
      paymentId: `MOCK_${Date.now()}`,
      conversationId: paymentData.conversationId,
      price: paymentData.price.toString(),
      paidPrice: paymentData.price.toString(),
      currency: paymentData.currency,
      installment: paymentData.installment || '1',
      fraudStatus: 1,
      paymentStatus: 'SUCCESS',
      errorCode: null,
      errorMessage: null,
      rawResponse: {
        status: 'success',
        paymentId: `MOCK_${Date.now()}`,
        conversationId: paymentData.conversationId,
      },
    };
  }
}

