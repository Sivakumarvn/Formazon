import Product from '../models/Product.js'
import Order from '../models/Order.js';
import Stripe from 'stripe'
import User from '../models/User.js'


// Place Order COD : /api/order/cod
export const placeOrderCOD = async(req,res)=>{
    try {
        const {items,address} = req.body;
        const userId = req.userId;
        if(!address || !Array.isArray(items) ||  items.length === 0){
            return res.json({success: false, message:'Invalid Data'});
        }
        // calculate amount using items
        let amount = await items.reduce(async (acc,item)=>{
            const product = await Product.findById(item.product);
            return (await acc) + product.offerPrice*item.quantity;
        },0)
        // add tax charge (5%)
        amount +=Math.round(amount*0.05);

        await Order.create({
            userId,
            items,
            amount,
            address,
            paymentType: 'COD',
        });
        // Clear user cart
        await User.findByIdAndUpdate(userId, { cartItems: [] });
        return res.json({success:true, message:"Order placed successfully"})
    } catch (error) {
        console.error(error.message);
        return res.json({ success: false, message: error.message });
    }
};

// Place Order Online : /api/order/stripe
export const placeOrderStripe = async(req,res)=>{
    try {
        const {items,address} = req.body;
        const userId = req.userId;
        const {origin}= req.headers;

        if(!address || !Array.isArray(items)|| items.length === 0){
            return res.json({success: false, message:'Invalid Data'});
        }

        let productData = [];
        // calculate amount using items
        let amount = await items.reduce(async (acc,item)=>{
            const product = await Product.findById(item.product);
            productData.push({
                name: product.name,
                price: product.offerPrice,
                quantity: item.quantity,
            });
            return (await acc) + product.offerPrice*item.quantity;
        },0)
        // add tax charge (5%)
        amount +=Math.round(amount*0.05);

        const order = await Order.create({
            userId,
            items,
            amount,
            address,
            paymentType: 'Online',
        });
        // Stripe Gateway Initialize
        const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

        // create line items for stripe
        const line_items = productData.map((item)=>{
            return {
                price_data:{
                    currency:'inr',
                    product_data:{
                        name: item.name,
                    },
                    unit_amount: Math.round(item.price * 1.05 * 100)
                },
                quantity: item.quantity,
            }
        })

        // Create session
        const session = await stripeInstance.checkout.sessions.create({
            line_items,
            mode:'payment',
            success_url: `${origin}/loader?next=my-orders`,
            cancel_url: `${origin}/cart`,
            metadata:{
                orderId: order._id.toString(),
                userId,
            }
        })

        return res.json({success:true, url: session.url});
    } catch (error) {
        console.error(error.message);
        return res.json({ success: false, message: error.message });
    }
};

// Stripe Webhook to verify payments Action :/stripe
export const stripeWebhooks = async (request,response)=>{
    //  Stripe Gateway Initialize
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

    const sig = request.headers["stripe-signature"];
    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(
            request.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        )
    } catch (error) {
        return response.status(400).send(`Webhook Error: ${error.message}`);
    }

    // Handle the event

    // switch (event.type) {
    //     case "payment_intent.succeeded":{
    //         const paymentIntent = event.data.object;
    //         const paymentIntentId = paymentIntent.id;

    //         // getting session metadata
    //         const session = await stripeInstance.checkout.sessions.list({
    //             payment_intent: paymentIntentId,
    //             limit: 1,
    //         });

    //         const {orderId, userId} = session.data[0].metadata;
    //         // Mark payment as paid

    //         await Order.findByIdAndUpdate(orderId,{isPaid:true});
    //         // clear user cart
    //         await User.findByIdAndUpdate(userId,{cartItems:[]}) 
    //         break;
    //     }
    //     case "payment_intent.payment_failed":{
    //         const paymentIntent = event.data.object;
    //         const paymentIntentId = paymentIntent.id;

    //         // getting session metadata
    //         const session = await stripeInstance.checkout.sessions.list({
    //             payment_intent: paymentIntentId,
    //         });

    //         const { orderId } = session.data[0].metadata;
    //         await Order.findByIdAndDelete(orderId);
    //         break;
    //     }
    
    //     default:
    //         console.error(`Unhandled event type ${event.type}`)

    //         break;
    // }
    // response.json({received: true})

    try {
        switch (event.type) {
            case "payment_intent.succeeded": {
                const paymentIntent = event.data.object;
                const paymentIntentId = paymentIntent.id;
    
                // getting session metadata
                const session = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntentId,
                    limit: 1,
                });
    
                const { orderId, userId } = session.data[0].metadata;
    
                // Mark payment as paid
                await Order.findByIdAndUpdate(orderId, { isPaid: true });
    
                // clear user cart
                await User.findByIdAndUpdate(userId, { cartItems: [] });
                break;
            }
    
            case "payment_intent.payment_failed": {
                const paymentIntent = event.data.object;
                const paymentIntentId = paymentIntent.id;
    
                // getting session metadata
                const session = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntentId,
                });
    
                const { orderId } = session.data[0].metadata;
                await Order.findByIdAndDelete(orderId);
                break;
            }
    
            default:
                console.error(`Unhandled event type ${event.type}`);
                break;
        }
    
        response.json({ received: true });
    } catch (error) {
        console.error("Error handling Stripe webhook event:", error.message);
        response.status(500).json({ success: false, message: error.message });
    }
    
}

// Get Orders by User ID : /api/order/user

export const getUserOrders = async(req,res)=>{
    try {
        const userId = req.userId;
        const orders = await Order.find({
            userId,
            $or:[{paymentType: "COD"}, {isPaid: true}]
        }).populate("items.product address").sort({createdAt:-1});
        res.json({success:true, orders});
    } catch (error) {
        console.error(error.message);
        return res.json({ success: false, message: error.message });
    }
};

// Get all orders(for seller/admin) : /api/order/seller

export const getAllOrders = async(req,res)=>{
    try {
        const orders = await Order.find({
            $or:[{paymentType: "COD"}, {isPaid: true}]
        }).populate("items.product address").sort({createdAt:-1});
        res.json({success:true, orders});
    } catch (error) {
        console.error(error.message);
        return res.json({ success: false, message: error.message });
    }
};