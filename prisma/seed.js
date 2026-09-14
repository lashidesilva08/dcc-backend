import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding users and sellers...");

  // 1. Seed Seller Users and their Shops
  const hashedPassword = await bcrypt.hash("123", 10);

  const sellersData = [
    {
      name: "City Retailer",
      email: "seller@cityretailer.lk",
      phone: "+94771234567",
      shopName: "City Retailer",
      shopUrl: "city-retailer",
      businessType: "Retail",
      image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d",
      bannerImage:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab",
    },

    {
      name: "Tech Hub Sri Lanka",
      email: "techhub@gmail.com",
      phone: "+94770000001",
      shopName: "Tech Hub",
      shopUrl: "tech-hub",
      businessType: "Electronics",
      image: "https://images.unsplash.com/photo-1498049794561-7780e7231661",
      bannerImage:
        "https://images.unsplash.com/photo-1518770660439-4636190af475",
    },

    {
      name: "Fashion Corner",
      email: "fashion@gmail.com",
      phone: "+94770000002",
      shopName: "Fashion Corner",
      shopUrl: "fashion-corner",
      businessType: "Fashion",
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
      bannerImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d",
    },

    {
      name: "Home Essentials",
      email: "home@gmail.com",
      phone: "+94770000003",
      shopName: "Home Essentials",
      shopUrl: "home-essentials",
      businessType: "Home & Living",
      image: "https://images.unsplash.com/photo-1484154218962-a197022b5858",
      bannerImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d",
    },

    {
      name: "Fresh Mart",
      email: "freshmart@gmail.com",
      phone: "+94770000004",
      shopName: "Fresh Mart",
      shopUrl: "fresh-mart",
      businessType: "Groceries",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e",
    },

    {
      name: "Beauty Bliss",
      email: "beauty@gmail.com",
      phone: "+94770000005",
      shopName: "Beauty Bliss",
      shopUrl: "beauty-bliss",
      businessType: "Beauty",
      image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9",
    },

    {
      name: "Sports Zone",
      email: "sports@gmail.com",
      phone: "+94770000006",
      shopName: "Sports Zone",
      shopUrl: "sports-zone",
      businessType: "Sports",
      image: "https://images.unsplash.com/photo-1517649763962-0c623066013b",
    },

    {
      name: "Kids Paradise",
      email: "kids@gmail.com",
      phone: "+94770000007",
      shopName: "Kids Paradise",
      shopUrl: "kids-paradise",
      businessType: "Kids",
      image: "https://images.unsplash.com/photo-1516627145497-ae6968895b74",
    },

    {
      name: "Gadget World",
      email: "gadget@gmail.com",
      phone: "+94770000008",
      shopName: "Gadget World",
      shopUrl: "gadget-world",
      businessType: "Electronics",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
    },
  ];

  // We can add more sellers here as needed
  const sellers = [];

  for (const s of sellersData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        password: hashedPassword,
        role: "SELLER",
        phone: s.phone,
        verified: true,
      },
    });

    const seller = await prisma.seller.upsert({
      where: { userId: user.id },
      update: {
        image: s.image,
        shopName: s.shopName,
        shopUrl: s.shopUrl,
        businessType: s.businessType,
        // Initialize with an empty array
      },

      create: {
        userId: user.id,
        shopName: s.shopName,
        shopUrl: s.shopUrl,
        businessType: s.businessType,
        image: s.image,
        status: "active",
        commissionRate: 10,
      },
    });

    sellers.push(seller);
  }

  const sellerMap = {
    electronics: sellers.find((s) => s.businessType === "Electronics")?.id,

    fashion: sellers.find((s) => s.businessType === "Fashion")?.id,

    groceries: sellers.find((s) => s.businessType === "Groceries")?.id,

    home: sellers.find((s) => s.businessType === "Home & Living")?.id,

    beauty: sellers.find((s) => s.businessType === "Beauty")?.id,

    sports: sellers.find((s) => s.businessType === "Sports")?.id,

    kids: sellers.find((s) => s.businessType === "Kids")?.id,
  };

  // 2. Seed a Reviewer User
  const reviewer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      name: "John Doe",
      email: "customer@example.com",
      password: await bcrypt.hash("123", 10),
      role: "CUSTOMER",
      verified: true,
    },
  });

  // 3. Seed Categories (using createMany with skipDuplicates)

  console.log("Seeding categories...");
  const categoriesData = [
    { name: "Electronics", icon: "Laptop" },
    { name: "Fashion", icon: "Shirt" },
    { name: "Groceries", icon: "ShoppingBag" },
    { name: "Home", icon: "Home" },
    { name: "Beauty", icon: "Sparkles" },
    { name: "Sports", icon: "Activity" },
    { name: "Kids", icon: "Smile" },
  ];

  await prisma.category.createMany({
    data: categoriesData,
    skipDuplicates: true,
  });

  // Fetch categories to get IDs
  const categories = await prisma.category.findMany();
  const categoriesMap = categories.reduce((acc, cat) => {
    acc[cat.name.toLowerCase()] = cat.id;
    return acc;
  }, {});

  const listings = [
    // Electronics
    {
      slug: "electronics",
      title: "WH-1000XM5 Wireless Headphones",
      desc: "SONY - Industry leading noise canceling wireless headphones.",
      price: 97750,
      img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
    },
    {
      slug: "electronics",
      title: "AirPods Pro (2nd Generation)",
      desc: "APPLE - Active Noise Cancellation, Adaptive Audio.",
      price: 64990,
      img: "https://images.unsplash.com/photo-1606741965326-cb990ae01bb2?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      slug: "electronics",
      title: "Galaxy S24 Ultra 256GB",
      desc: "SAMSUNG - Titanium built, Galaxy AI integrated smartphone.",
      price: 289990,
      img: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500",
    },
    {
      slug: "electronics",
      title: "Ultra-Smart Watch Pro Series 10",
      desc: "APPLE - Advanced fitness tracking and smart notifications.",
      price: 45990,
      img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
    },
    {
      slug: "electronics",
      title: 'MacBook Air 13" M3 Chip',
      desc: "APPLE - Supercharged by M3, incredibly thin laptop.",
      price: 324990,
      img: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500",
    },
    {
      slug: "electronics",
      title: "MX Master 3S Wireless Mouse",
      desc: "LOGITECH - Ergonomic performance mouse.",
      price: 28500,
      img: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500",
    },
    {
      slug: "electronics",
      title: "JBL Flip 6 Portable Bluetooth Speaker",
      desc: "JBL - Portable waterproof speaker with PartyBoost.",
      price: 34990,
      img: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500",
    },
    {
      slug: "electronics",
      title: "Canon EOS R50 Mirrorless Camera Kit",
      desc: "CANON - Compact mirrorless camera with 18-45mm lens kit.",
      price: 198990,
      img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500",
    },

    // Fashion
    {
      slug: "fashion",
      title: "Men's Linen Blend Shirt",
      desc: "H&M - Lightweight linen blend casual shirt.",
      price: 4990,
      img: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500",
    },
    {
      slug: "fashion",
      title: "Classic Denim Jacket",
      desc: "LEVI'S - Timeless denim jacket with button closures.",
      price: 12990,
      img: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500",
    },
    {
      slug: "fashion",
      title: "Handloom Cotton Saree",
      desc: "NANDI - Beautifully crafted handloom cotton saree.",
      price: 18500,
      img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500",
    },
    {
      slug: "fashion",
      title: "Air Max Running Sneakers",
      desc: "NIKE - Comfortable performance running sneakers.",
      price: 24990,
      img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
    },
    {
      slug: "fashion",
      title: "Structured Tote Handbag",
      desc: "CHARLES & KEITH - Chic structured handbag for everyday use.",
      price: 15990,
      img: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500",
    },
    {
      slug: "fashion",
      title: "Kids Cotton Co-ord Set",
      desc: "MINI MODE - Soft breathable cotton co-ord set for kids.",
      price: 3990,
      img: "https://images.unsplash.com/photo-1622290319146-7b63df48a635?w=500",
    },

    // Groceries
    {
      slug: "groceries",
      title: "Premium Nadu Rice 5kg",
      desc: "ARALYA - High quality local premium Nadu rice.",
      price: 2450,
      img: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500",
    },
    {
      slug: "groceries",
      title: "Virgin Coconut Oil 1L",
      desc: "MARVELLA - 100% natural virgin coconut oil.",
      price: 1890,
      img: "https://images.unsplash.com/photo-1588413336009-1f4219f2d5dd?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      slug: "groceries",
      title: "Premium Ceylon Tea 100 Bags",
      desc: "DILMAH - Finest pure Ceylon black tea.",
      price: 1290,
      img: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500",
    },
    {
      slug: "groceries",
      title: "Full Cream Milk Powder 400g",
      desc: "ANCHOR - Nourishing full cream milk powder.",
      price: 1650,
      img: "https://images.unsplash.com/photo-1553456558-aff63285bdd1?w=500",
    },
    {
      slug: "groceries",
      title: "Assorted Biscuit Family Pack",
      desc: "MALIBAN - Assorted biscuits in a family value pack.",
      price: 990,
      img: "https://plus.unsplash.com/premium_photo-1697127199951-a4f9e693b2e0?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      slug: "groceries",
      title: "Curry Powder Variety Pack",
      desc: "MD - Authentic Sri Lankan curry powder variety pack.",
      price: 750,
      img: "https://images.unsplash.com/photo-1777383305839-3ff93fe1bff0?q=80&w=1172&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },

    // Home
    {
      slug: "home",
      title: "Cotton Bedsheet Set (Queen)",
      desc: "DREAM HOME - Pure cotton comfortable bedsheet with 2 pillowcases.",
      price: 6990,
      img: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500",
    },
    {
      slug: "home",
      title: "Non-Stick Cookware Set 5pc",
      desc: "PRESTIGE - Heavy duty non-stick cooking pots.",
      price: 12490,
      img: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=500",
    },
    {
      slug: "home",
      title: "LED Desk Lamp with USB Port",
      desc: "PHILIPS - Smart LED desk lamp with USB charging port.",
      price: 5490,
      img: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500",
    },
    {
      slug: "home",
      title: "Blackout Curtain Pair",
      desc: "STYLE LIVING - Premium blackout curtain pair.",
      price: 8990,
      img: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500",
    },
    {
      slug: "home",
      title: "Stackable Storage Boxes (3)",
      desc: "IKEA LK - Modular stackable storage solution.",
      price: 4590,
      img: "https://images.unsplash.com/photo-1590451887427-21e25ebaccd8?q=80&w=1129&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      slug: "home",
      title: "Compact Vacuum Cleaner",
      desc: "BLACK+DECKER - Lightweight compact vacuum cleaner.",
      price: 18990,
      img: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500",
    },

    // Beauty
    {
      slug: "beauty",
      title: "Hyaluronic Acid Serum 30ml",
      desc: "THE ORDINARY - Hydration support formula with vegan HA.",
      price: 4200,
      img: "https://images.unsplash.com/photo-1665763630810-e6251bdd392d?w=1000&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8SHlhbHVyb25pYyUyMEFjaWQlMjBTZXJ1bSUyMDMwbWx8ZW58MHx8MHx8fDA%3D0",
    },
    {
      slug: "beauty",
      title: "Matte Lipstick – Ruby Woo",
      desc: "MAC - Iconic retro matte lipstick in bold red.",
      price: 6500,
      img: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500",
    },
    {
      slug: "beauty",
      title: "SPF 50+ Ultra Sheer Sunscreen 88ml",
      desc: "NEUTROGENA - Lightweight broad spectrum sunscreen.",
      price: 3800,
      img: "https://images.unsplash.com/photo-1556229010-aa3f7ff66b24?w=500",
    },
    {
      slug: "beauty",
      title: "Bright Crystal EDT 90ml",
      desc: "VERSACE - Feminine and luminous eau de toilette.",
      price: 18500,
      img: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=500",
    },
    {
      slug: "beauty",
      title: "Total Repair Shampoo 400ml",
      desc: "LOREAL - Strengthening shampoo for damaged hair.",
      price: 1890,
      img: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500",
    },
    {
      slug: "beauty",
      title: "Sheet Mask Pack of 5",
      desc: "GARNIER - Hydrating and brightening sheet masks.",
      price: 1290,
      img: "https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=500",
    },

    // Sports
    {
      slug: "sports",
      title: "Non-Slip Yoga Mat 6mm",
      desc: "DECATHLON - Perfect cushioning and grip yoga mat.",
      price: 4990,
      img: "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500",
    },
    {
      slug: "sports",
      title: "Adjustable Dumbbell Pair 20kg",
      desc: "PRO FITNESS - Versatile adjustable weights for home gym.",
      price: 24990,
      img: "https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=500",
    },
    {
      slug: "sports",
      title: "English Willow Cricket Bat",
      desc: "SS - Professional English willow cricket bat.",
      price: 15990,
      img: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=500",
    },
    {
      slug: "sports",
      title: "Strike Football Size 5",
      desc: "NIKE - FIFA quality mark match football.",
      price: 5990,
      img: "https://images.unsplash.com/photo-1760177379223-173d9bdfca71?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      slug: "sports",
      title: "Training Gym Bag 50L",
      desc: "ADIDAS - Durable gym bag with multiple compartments.",
      price: 8990,
      img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500",
    },
    {
      slug: "sports",
      title: "Insulated Sports Water Bottle 750ml",
      desc: "WILSON - Keeps drinks cold for 24 hours.",
      price: 2499,
      img: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500",
    },

    // Kids
    {
      slug: "kids",
      title: "Creative Building Blocks Set",
      desc: "LEGO - 450-piece creative building toy set for kids.",
      price: 8990,
      img: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500",
    },
    {
      slug: "kids",
      title: "Plush Teddy Bear Large",
      desc: "SOFT TOYS - Ultra soft and cuddly plush teddy bear.",
      price: 3490,
      img: "https://images.unsplash.com/photo-1559251606-c623743a6d76?w=500",
    },
    {
      slug: "kids",
      title: "Kids 3-Wheel Scooter",
      desc: "MICRO - Foldable 3-wheel scooter for ages 3–8.",
      price: 12990,
      img: "https://images.unsplash.com/photo-1597200381847-30ec200eeb9a?w=500",
    },
    {
      slug: "kids",
      title: "Story Book Bundle (5)",
      desc: "SCHOLASTIC - Five classic illustrated story books.",
      price: 2990,
      img: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500",
    },
    {
      slug: "kids",
      title: "Ultimate Art & Craft Kit",
      desc: "CRAYOLA - Complete art kit with crayons, paint, and more.",
      price: 5490,
      img: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500",
    },
    {
      slug: "kids",
      title: "World Map Jigsaw Puzzle 100pc",
      desc: "RAVENSBURGER - Educational world map jigsaw puzzle.",
      price: 3990,
      img: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500",
    },
  ];

  console.log("Seeding favourite shops...");

  await prisma.favouriteShop.createMany({
    data: [
      {
        userId: reviewer.id,
        sellerId: sellers[0].id,
      },
      {
        userId: reviewer.id,
        sellerId: sellers[2].id,
      },
      {
        userId: reviewer.id,
        sellerId: sellers[4].id,
      },
    ],
    skipDuplicates: true,
  });

  //sellerId: 1, categoryId will be mapped from slug, title, description, price, img (for variant image), status: 'active', createdAt/updatedAt auto
  //const seller = sellers[0];

  console.log("Seeding listings with product variants and images...");

  // 20 new products with different sellers
  const newListings = [
    // Electronics
    {
      slug: "electronics",
      title: "Bose QuietComfort 45 Headphones",
      desc: "BOSE - Industry leading noise canceling.",
      price: 89990,
      sold: 45,
      img: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500",
    },
    {
      slug: "electronics",
      title: "Samsung Galaxy Buds Pro",
      desc: "SAMSUNG - True wireless earbuds with ANC.",
      price: 34990,
      sold: 55,
      img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500",
    },

    // Fashion
    {
      slug: "fashion",
      title: "Premium Wool Winter Coat",
      desc: "TOMMY HILFIGER - Classic wool winter coat.",
      price: 45990,
      sold: 25,
      img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500",
    },
    {
      slug: "fashion",
      title: "Elegant Silk Dress",
      desc: "ZARA - Beautiful elegant silk evening dress.",
      price: 28990,
      sold: 35,
      img: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=500",
    },

    // Groceries
    {
      slug: "groceries",
      title: "Organic Olive Oil 500ml",
      desc: "BERTOLLI - Premium extra virgin olive oil.",
      price: 2890,
      sold: 70,
      img: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500",
    },
    {
      slug: "groceries",
      title: "Almond Butter 500g",
      desc: "SKIPPY - Creamy almond butter.",
      price: 1990,
      sold: 60,
      img: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500",
    },

    // Home
    {
      slug: "home",
      title: "Premium Pillow Set of 2",
      desc: "LAYLA - Memory foam pillow set.",
      price: 9990,
      sold: 40,
      img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500",
    },
    {
      slug: "home",
      title: "Smart LED Light Bulbs (4pack)",
      desc: "LIFX - Smart RGB LED bulbs.",
      price: 12990,
      sold: 30,
      img: "https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?w=500",
    },

    // Beauty
    {
      slug: "beauty",
      title: "Premium Face Cream 50ml",
      desc: "OLAY - Anti-aging face cream.",
      price: 5990,
      sold: 0,
      img: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500",
    },
    {
      slug: "beauty",
      title: "Face Cream 30ml",
      desc: "MINOXIDIL - Professional hair serum.",
      price: 3490,
      sold: 0,
      img: "https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=500",
    },

    // Sports
    {
      slug: "sports",
      title: "Resistance Band Set 5pc",
      desc: "WODSOCIAL - Complete resistance band set.",
      price: 3490,
      sold: 0,
      img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500",
    },
    {
      slug: "sports",
      title: "Running Belt with Bottle",
      desc: "TRAVELON - Hydration running belt.",
      price: 2990,
      sold: 0,
      img: "https://images.unsplash.com/photo-1486218119243-13883505764c?w=500",
    },

    // Kids
    {
      slug: "kids",
      title: "Kids Bicycle 20 Inch",
      desc: "DECATHLON - Durable kids bicycle.",
      price: 18990,
      sold: 0,
      img: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=500",
    },
    {
      slug: "kids",
      title: "Educational Robot Toy",
      desc: "OZOBOT - Programmable educational robot.",
      price: 12490,
      sold: 0,
      img: "https://images.unsplash.com/photo-1561144257-e32e8efc6c4f?w=500",
    },

    // Electronics
    {
      slug: "electronics",
      title: "USB-C Hub 7-in-1",
      desc: "ANKER - Multi-port USB-C hub.",
      price: 6990,
      sold: 35,
      img: "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=500",
    },
    {
      slug: "electronics",
      title: "4K Webcam with Mic",
      desc: "LOGITECH - Professional 4K webcam.",
      price: 24990,
      sold: 28,
      img: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500",
    },

    // Fashion
    {
      slug: "fashion",
      title: "Premium Leather Belt",
      desc: "GUCCI - Genuine leather belt.",
      price: 15990,
      sold: 42,
      img: "https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=500",
    },
    {
      slug: "fashion",
      title: "Sports Running Jacket",
      desc: "ADIDAS - Waterproof running jacket.",
      price: 11990,
      sold: 50,
      img: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=500",
    },

    // Groceries
    {
      slug: "groceries",
      title: "Raw Honey 500g",
      desc: "Y.S. ECO BEE - Pure raw honey.",
      price: 1290,
      sold: 80,
      img: "https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=500",
    },
    {
      slug: "groceries",
      title: "Dark Chocolate 85% 100g",
      desc: "LINDT - Premium dark chocolate.",
      price: 890,
      sold: 95,
      img: "https://images.unsplash.com/photo-1511381939415-e44015466834?w=500",
    },
  ];

  console.log("Seeding original listings...");

  const defaultSeller =
    sellers.find((s) => s.shopUrl === "city-retailer") || sellers[0];
  // 3. Seed Original Listings (from sellers[0])
  for (const item of listings) {
    // 1. Handle Listing Creation
    let listing = await prisma.listing.findFirst({
      where: { title: item.title },
    });

    if (!listing) {
      console.log(`Creating new listing: ${item.title}`);
      const cleanSku = item.title
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);
      const variantDefinitions = getVariantDefinitions(item);

      const variantsToCreate = variantDefinitions.map((v) => ({
        sku: `${cleanSku}-${v.suffix}`,
        price: item.price,
        stock: v.stock,
        status: "active",
        attributes: v.attrs,
        images: { create: [{ url: v.variantImg || item.img, isMain: true }] },
      }));

      listing = await prisma.listing.create({
        data: {
          sellerId: defaultSeller.id,
          categoryId: categoriesMap[item.slug],
          title: item.title,
          description: item.desc,
          status: "active",
          variants: { create: variantsToCreate },
        },
      });
    } else {
      console.log(`Listing already exists: ${item.title}`);
    }

    // 2. Handle Review Creation (Always runs regardless of whether listing was newly created or existing)
    const reviewExists = await prisma.review.findFirst({
      where: {
        listingId: listing.id,
        userId: reviewer.id, // Good practice to check by user too
      },
    });

    if (!reviewExists) {
      await prisma.review.create({
        data: {
          rating: 5,
          comment: "Excellent quality! Highly recommended.",
          userId: reviewer.id,
          listingId: listing.id,
        },
      });
      console.log(`Added review for: ${item.title}`);
    }
  }

  console.log("Seeding 20 new listings from different sellers...");

  // Seed new listings with different sellers
  for (const item of newListings) {
    let listing = await prisma.listing.findFirst({
      where: { title: item.title },
    });

    if (!listing) {
      console.log(
        `Creating new listing: ${item.title} (Seller: ${item.seller})`,
      );
      const cleanSku = item.title
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);
      const variantDefinitions = getVariantDefinitions(item);
      const slugToBusiness = {
        electronics: "electronics",
        fashion: "fashion",
        groceries: "groceries",
        home: "home",
        beauty: "beauty",
        sports: "sports",
        kids: "kids",
      };

      const sellerId = sellerMap[slugToBusiness[item.slug]];

      const selectedSeller = sellers.find((s) => s.id === sellerId); // seller number is 1-9, array is 0-8

      const variantsToCreate = variantDefinitions.map((v) => ({
        sku: `${cleanSku}-${selectedSeller.shopUrl.substring(0, 3).toUpperCase()}-${v.suffix}`,
        price: item.price,
        stock: v.stock,
        status: "active",
        attributes: v.attrs,
        images: { create: [{ url: v.variantImg || item.img, isMain: true }] },
      }));

      listing = await prisma.listing.create({
        data: {
          sellerId: selectedSeller.id,
          categoryId: categoriesMap[item.slug],
          title: item.title,
          description: item.desc,
          status: "active",
          sold: item.sold,
          variants: {
            create: variantsToCreate,
          },
        },
      });
    } else {
      console.log(`Listing already exists: ${item.title}`);
    }

    // Handle Review Creation for new listings
    const reviewExists = await prisma.review.findFirst({
      where: {
        listingId: listing.id,
        userId: reviewer.id,
      },
    });

    if (!reviewExists) {
      await prisma.review.create({
        data: {
          rating: Math.floor(Math.random() * 2) + 4,
          comment: "Excellent quality! Highly recommended.",
          userId: reviewer.id,
          listingId: listing.id,
        },
      });
      console.log(`Added review for: ${item.title}`);
    }
  }

  // Seed sample Payout records for sellers
  console.log("Seeding payouts for sellers...");

  for (let i = 0; i < sellers.length; i++) {
    const seller = sellers[i];

    await prisma.payout.createMany({
      data: [
        {
          payoutNumber: `PAY-${1000 + i}-01`,
          sellerId: seller.id,
          amount: 45000.0,
          bankAccountInfo: "HNB Bank - ****4829",
          status: "cleared",
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
        {
          payoutNumber: `PAY-${1000 + i}-02`,
          sellerId: seller.id,
          amount: 62000.0,
          bankAccountInfo: "Commercial Bank - ****1102",
          status: "cleared",
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        },
        {
          payoutNumber: `PAY-${1000 + i}-03`,
          sellerId: seller.id,
          amount: 28500.0,
          bankAccountInfo: "Sampath Bank - ****9043",
          status: "pending",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log("Payouts seeded successfully.");

  // 1. Update all order items for this seller to 'delivered'
  await prisma.orderItem.updateMany({
    where: {
      sellerId: 6,
    },
    data: {
      itemStatus: "delivered",
    },
  });

  // 2. Fetch the unique order IDs linked to this seller's items
  const sellerItems = await prisma.orderItem.findMany({
    where: { sellerId: 6 },
    select: { orderId: true },
  });
  const orderIds = sellerItems.map((item) => item.orderId);

  // 3. Update those specific orders to 'paid'
  await prisma.order.updateMany({
    where: {
      id: { in: orderIds },
    },
    data: {
      paymentStatus: "paid",
    },
  });
}

function getVariantDefinitions(item) {
  const isDevice =
    item.title.includes("Galaxy") || item.title.includes("MacBook");

  if (item.slug === "fashion") {
    return [
      {
        suffix: "BLK-S",
        attrs: {
          Color: "Black",
          Size: "S",
        },
        stock: 15,
        variantImg: item.img,
      },
      {
        suffix: "BLK-M",
        attrs: {
          Color: "Black",
          Size: "M",
        },
        stock: 25,
        variantImg: item.img,
      },
      {
        suffix: "WHT-M",
        attrs: {
          Color: "White",
          Size: "M",
        },
        stock: 20,
        variantImg: item.img,
      },
      {
        suffix: "WHT-L",
        attrs: {
          Color: "White",
          Size: "L",
        },
        stock: 10,
        variantImg: item.img,
      },
    ];
  }

  if (item.slug === "electronics") {
    return [
      {
        suffix: "SLV",
        attrs: {
          Color: "Silver",
          Size: isDevice ? "256GB" : "Standard",
        },
        stock: 30,
        variantImg: item.img,
      },
      {
        suffix: "GPH",
        attrs: {
          Color: "Graphite",
          Size: isDevice ? "512GB" : "Standard",
        },
        stock: 20,
        variantImg: item.img,
      },
    ];
  }

  if (item.slug === "home") {
    return [
      {
        suffix: "GY-QN",
        attrs: {
          Color: "Slate Gray",
          Size: "Queen",
        },
        stock: 15,
        variantImg: item.img,
      },
      {
        suffix: "GY-KG",
        attrs: {
          Color: "Slate Gray",
          Size: "King",
        },
        stock: 12,
        variantImg: item.img,
      },
      {
        suffix: "NV-QN",
        attrs: {
          Color: "Navy Blue",
          Size: "Queen",
        },
        stock: 18,
        variantImg: item.img,
      },
    ];
  }

  return [
    {
      suffix: "STD",
      attrs: {
        Color: "Default",
        Size: "Standard",
      },
      stock: 50,
      variantImg: item.img,
    },
  ];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
