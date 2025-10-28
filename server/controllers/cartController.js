import User from "../models/User.js";


// Update User CartData : /api/cart/update


export const updateCart = async (req, res) => {
    try {
        const userId = req.userId;
        const {cartItems} = req.body;
        if (!userId) {
            return res.json({ success: false, message: "User not found" });
          }
        await User.findByIdAndUpdate(
            userId, 
            { cartItems },
            );
        res.json({ success: true, message: "Cart Updated" })
        // console.log("message:Cart Updated");
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
}