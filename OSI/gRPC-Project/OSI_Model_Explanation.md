# OSI 7-Layer-এর মাধ্যমে gRPC-Web রিকোয়েস্ট লাইফসাইকেল (In-Depth Technical Walkthrough)

React Client ([App.tsx](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/gRPC-Project/product-management-frontend/src/App.tsx)) থেকে .NET Clean Architecture backend-এ gRPC-Web এর মাধ্যমে পাঠানো `CreateProduct` (Write) এবং `GetAllProducts` (Read) অপারেশনের রিকোয়েস্ট ও রেসপন্স কিভাবে OSI (Open Systems Interconnection) মডেলের ৭টি লেয়ারের মধ্য দিয়ে কাজ করে, নিচে তার প্রতিটি ধাপের গভীর প্রযুক্তিগত বিবরণ দেওয়া হলো।

---

## 🛠️ gRPC বনাম REST JSON (এনকোডিং ও ট্রান্সপোর্ট ডিফারেন্স)

* **REST JSON:** রিকোয়েস্ট পাঠানোর সময় প্লেইন-টেক্সট JSON ফরম্যাটে ডাটা ট্রাভেল করে। যেমন: `{"name":"Gaming Mouse","price":49.99}`। এটি রিড-অ্যাবল হলেও আকারে বড় এবং পার্স করতে CPU ওভারহেড বেশি হয়।
* **gRPC (Protobuf):** ডাটাকে অত্যন্ত কমপ্যাক্ট **Protocol Buffers (Protobuf)** বাইনারি ফরম্যাটে সিরিয়ালাইজ করে। 
* **gRPC-Web Enveloping:** ব্রাউজার সরাসরি HTTP/2 ট্রেইলার বা র ফ্রেম রিড করতে পারে না। তাই gRPC-Web প্রোটোকলে প্রতিটি বাইনারি মেসেজের শুরুতে একটি **৫-বাইটের প্রোটো-ফ্রেম হেডার** যুক্ত করা হয়:
  * **১ম বাইট (Flag):** `0x00` (নরমাল ডাটা) অথবা `0x80` (ট্রেইলার)।
  * **২য় থেকে ৫ম বাইট (Length):** বিগ-এন্ডিয়ান (Big-Endian) ইন্টিজার যা মেসেজ বডির দৈর্ঘ্য নির্দেশ করে।
  * **বডি (Body):** সিরিয়ালাইজড বাইনারি Protobuf ডাটা।

---

## 🔄 OSI Model-এর ৭টি লেয়ারে ডাটার রূপান্তর ও যাতায়াত (Encapsulation & Transmission)

ইউজার যখন ব্রাউজারে ইনপুট দিয়ে **"Save Product"** বাটনে ক্লিক করে, তখন ডাটা প্যাকেটাইজেশনের ধাপগুলো নিচে চিত্রসহ ব্যাখ্যা করা হলো:

```text
[React Client (App.tsx)]
       │
       │ (1) Send gRPC-Web binary request (CreateProduct)
       ▼
[.NET Presentation (gRPC-Web)] ──┐ (2) GrpcWebMiddleware translates 
       │                         │     to standard gRPC
       │ ◄───────────────────────┘
       │
       │ (3) Send CreateProductCommand
       ▼
[Application (MediatR CQRS)] ────┐ (4) Validate and map 
       │                         │     to Domain Entity
       │ ◄───────────────────────┘
       │
       │ (5) AddAsync(product)
       ▼
[Infrastructure (EF Core)]
       │
       │ (6) Execute INSERT INTO "Products"
       ▼
[PostgreSQL (Supabase)]
       │
       │ (7) Returns generated ID
       ▼
[Infrastructure (EF Core)]
       │
       │ (8) SaveChanges Succeeded
       ▼
[Application (MediatR CQRS)]
       │
       │ (9) Returns ProductDto
       ▼
[.NET Presentation (gRPC-Web)] ──┐ (10) Map ProductDto to
       │                         │      Protobuf Response
       │ ◄───────────────────────┘
       │
       │ (11) Returns gRPC-Web binary response
       ▼
[React Client (App.tsx)]
```

---

### 1. Application Layer (লেয়ার ৭) - ডাটা জেনারেট ও কুয়েরি তৈরি
এই লেয়ারে ইউজার অ্যাপ্লিকেশন ইন্টারফেসের সাথে ইন্টারঅ্যাক্ট করে ডাটা ইনপুট দেয়।

* **ক্লায়েন্ট এন্ড (React App.tsx):** ইউজার ইনপুট ফিল্ডে টাইপ করেন:
  * Name: `Gaming Mouse`
  * Description: `RGB mouse`
  * Price: `49.99`
  * Stock: `50`
* **মেথড ট্রিগার:** `createProduct(...)` এপিআই কল করা হয়। Connect RPC ফ্রেমওয়ার্ক ক্লায়েন্ট এন্ডে এপিআই রিকোয়েস্ট তৈরি করে। 
* **প্যাকেট অ্যাসাইনমেন্ট:** `CreateProductRequest` অবজেক্ট মেমরিতে কনস্ট্রাক্ট করা হয়।

---

### 2. Presentation Layer (লেয়ার ৬) - বাইনারি সিরিয়ালাইজেশন ও সিকিউরিটি
মেমরিতে থাকা অবজেক্টকে নেটওয়ার্ক দিয়ে পাঠানোর উপযোগী ফরম্যাটে রূপান্তর এবং এনক্রিপশন করা এই লেয়ারের কাজ।

* **Protobuf Serialization (ডাটা কম্প্রেশন):**
  মেমোরি অবজেক্টকে Protobuf এর নিয়ম অনুসারে বাইট-অ্যারেতে রূপান্তর করা হয়। Protobuf এ ডাটা `[Tag/WireType][Value]` হিসেবে সেভ হয়।
  * **Field 1 (Name: string) = "Gaming Mouse":** tag `0x0A` (ফিল্ড ১, ওয়্যার টাইপ ২), দৈর্ঘ্য `12` বাইট, তারপর টেক্সটের বাইনারি কোড।
  * **Field 3 (Price: double) = 49.99:** tag `0x19` (ফিল্ড ৩, ওয়্যার টাইপ ১), তারপর ৬৪-বিট ফ্লোটিং পয়েন্ট বাইনারি ভ্যালু।
  * **Field 4 (Stock: int32) = 50:** tag `0x20` (ফিল্ড ৪, ওয়্যার টাইপ ০), তারপর Varint ফরম্যাটে `50` এর বাইনারি।
  * মেসেজটির শুরুতে gRPC-Web স্পেসিফিকেশন অনুযায়ী **৫-বাইটের প্রিফিক্স হেডার** যুক্ত হয় (যেমন: `0x00 0x00 0x00 0x1E` -> ৩০ বাইট ডাটা বডি)।
* **SSL/TLS Encryption (নিরাপত্তা):** যদি কানেকশনটি HTTPS হয়, তবে এই ধাপে ডাটাকে প্রতি সেশনের অ্যাসিনক্রোনাস কী (Symmetric Encryption Key) দ্বারা এনক্রিপ্ট করা হয়। এর ফলে নেটওয়ার্ক লাইনে থাকা হ্যাকাররা ডাটা দেখতে পায় না।

---

### 3. Session Layer (লেয়ার ৫) - কানেকশন ডিরেকশন ও পোর্ট বাইন্ডিং
কমিউনিকেশন চ্যানেল চালু করা, ট্র্যাক করা এবং সেশন নিয়ন্ত্রণ করা এই লেয়ারের কাজ।

* **HTTP/2 Multiplexing:** gRPC প্রোটোকল সেশনের স্থায়িত্ব বজায় রাখতে HTTP/2 ব্যবহার করে। সেশন লেয়ারে সার্ভার ও ক্লায়েন্টের মধ্যে সিঙ্গেল TCP কানেকশনের ওপর মাল্টিপল লজিক্যাল ট্রাফিক স্ট্রিম (Stream ID) তৈরি করা হয়। 
* রিকোয়েস্টের সাথে একটি নির্দিষ্ট **Stream ID** (যেমন: `Stream-ID: 3`) অ্যাসাইন করা হয়, যেন ক্লায়েন্ট ও সার্ভার বুঝতে পারে যে এই প্যাকেটটি এই নির্দিষ্ট রিকোয়েস্ট-রেসপন্সের অংশ।

---

### 4. Transport Layer (লেয়ার ৪) - নির্ভরযোগ্য ট্রান্সমিশন ও প্যাকেট বিভাজন
এই লেয়ার নিশ্চিত করে যে ক্লায়েন্টের ডাটা কোনো ভুল বা প্যাকেট লস ছাড়াই সার্ভারে পৌঁছাবে।

* **TCP প্রোটোকল সিলেক্ট:** gRPC রিলায়েবল ট্রান্সমিশনের জন্য TCP ব্যবহার করে।
* **TCP Header Attachment (হেডার অ্যাসাইনমেন্ট):**
  * **Source Port:** ক্লায়েন্টের ওএস থেকে এলোমেলোভাবে নির্বাচিত পোর্ট (যেমন: `57391`)।
  * **Destination Port:** সার্ভারের পিসির পোর্ট: `5260` (HTTP) অথবা `7204` (HTTPS)।
  * **Sequence & Acknowledgment Numbers:** সিকোয়েন্স নম্বর (যেমন: `Seq=1001`) সেট করা হয়, যাতে সার্ভার ডাটা ওলটপালট পেলেও সিকোয়েন্স অনুযায়ী সাজাতে পারে।
  * **Flags:** কানেকশন বজায় রাখার জন্য `ACK` এবং `PSH` (Push Data immediately to Application) ফ্ল্যাগ অন করা হয়।
  * **Window Size:** ডাটা ফ্লো কন্ট্রোল করার জন্য ক্লায়েন্টের মেমোরির ধারণক্ষমতা জানানো হয়।
* **Segmentation:** ডাটার আকার বড় হলে সেটিকে নির্দিষ্ট সাইজের (MSS - Maximum Segment Size) TCP সেগমেন্টে ভাগ করা হয়।

---

### 5. Network Layer (লেয়ার ৩) - আইপি অ্যাড্রেসিং ও রাউটিং
প্যাকেটের উপর লজিক্যাল অ্যাড্রেস বসিয়ে বিশ্বের যেকোনো জায়গায় ডাটা সঠিক ঠিকানায় পাঠানোর দায়িত্ব এই লেয়ারের।

* **IP Header Attachment (হেডার অ্যাসাইনমেন্ট):**
  * **Source IP:** ক্লায়েন্টের আইপি অ্যাড্রেস (যেমন: `192.168.1.15` - লোকাল বা ডাব্লিউএএন আইপি)।
  * **Destination IP:** সার্ভারের আইপি অ্যাড্রেস (যেমন: লোকাল হোস্ট `127.0.0.1` বা প্রোডাকশন ডাটাবেজের ডোমেইন আইপি)।
  * **Protocol:** `6` (TCP নির্দেশক কোড)।
  * **TTL (Time to Live):** ডিফল্ট ভ্যালু (যেমন: `64`)। প্রতিবার প্যাকেট কোনো রাউটার পার হলে এই ভ্যালু ১ করে কমে। এটি শূন্য হয়ে গেলে প্যাকেট ড্রপ হয়, যাতে নেটওয়ার্কে প্যাকেট ইনফিনিট লুপে না ঘোরে।
* **Routing:** ডাটা সেগমেন্টটি এখন একটি **IP Packet**-এ পরিণত হয়।

---

### 6. Data Link Layer (লেয়ার ২) - ফিজিক্যাল মিডিয়াম অ্যাড্রেসিং
ডাটা লিক বা করাপশন ছাড়া সরাসরি পাশের নেটওয়ার্ক নোড বা রাউটারে পাঠানোর কাজ এই লেয়ার করে।

* **MAC Address Binding (হেডার অ্যাসাইনমেন্ট):**
  * **Source MAC Address:** ক্লায়েন্টের ডিভাইসের ওয়াইফাই/ইথারনেট কার্ডের নিজস্ব ম্যাক (যেমন: `A0:B1:C2:D3:E4:F5`)।
  * **Destination MAC Address:** ক্লায়েন্টের সবচেয়ে কাছের গেটওয়ে বা ওয়াইফাই রাউটার/অ্যাক্সেস পয়েন্টের ম্যাক অ্যাড্রেস (যেমন: `00:1A:2B:3C:4D:5E`)।
* **Frame Construction:** আইপি প্যাকেটটিকে ডাটালিংক হেডার দিয়ে মুড়িয়ে **Ethernet / Wi-Fi Frame** তৈরি করা হয়।
* **FCS (Frame Check Sequence):** ফ্রেমের শেষে একটি CRC (Cyclic Redundancy Check) কোড যুক্ত করা হয়। ট্রান্সমিশনের সময় ডাটা করাপ্ট বা নষ্ট হলে সার্ভার এই কোড দিয়ে তা সনাক্ত করতে পারে।

---

### 7. Physical Layer (লেয়ার ১) - বাতাসে সিগন্যাল পাঠানো (Wi-Fi Waves)
ডাটার বাইনারি বিটগুলোকে ফিজিক্যাল ওয়েভ বা কারেন্টে রূপান্তর করে বাতাসে ভাসিয়ে দেওয়ার চূড়ান্ত ধাপ।

* **Modulation (তরঙ্গে রূপান্তর):**
  * ক্লায়েন্টের ওয়াইফাই কার্ড ডিজিটাল বিটগুলোকে (`0` এবং `1`) RF (Radio Frequency) সিগন্যালে কনভার্ট করে।
  * এর জন্য **OFDM (Orthogonal Frequency Division Multiplexing)** বা **QAM (Quadrature Amplitude Modulation)** টেকনোলজি ব্যবহার করা হয়।
  * এই টেকনোলজিতে তরঙ্গের বিস্তার (Amplitude) এবং ফেজ (Phase) পরিবর্তন করে ডিজিটাল ডাটা ক্যারিয়ার তরঙ্গে সুপার-ইম্পোজ করা হয়।
* **Transmission:** ২.৪ GHz বা ৫ GHz ফ্রিকোয়েন্সির তড়িৎ চৌম্বকীয় তরঙ্গের (Electromagnetic Waves) মাধ্যমে ডাটা বাতাসে ছড়িয়ে দেওয়া হয় এবং তা সরাসরি ওয়াইফাই রাউটারের অ্যান্টেনা রিসিভ করে।

---

## 📥 সার্ভার কিভাবে ডাটা রিসিভ ও প্রসেস করে? (Decapsulation Flow)

রাউটারের তার বা সিগন্যাল হয়ে যখন ডাটা সার্ভার পিসিতে পৌঁছায়, তখন সম্পূর্ণ প্রক্রিয়াটি রিভার্স অর্ডারে ঘটে:

```text
[ Physical Layer ]  ──► বাতাসে RF সিগন্যাল রিসিভ করে বাইট-স্ট্রিমে পরিণত করে।
       │
[ Data Link Layer ] ──► Frame এর FCS চেক করে MAC অ্যাড্রেস মিলিয়ে IP Packet বের করে।
       │
[ Network Layer ]   ──► Destination IP অ্যাড্রেস মিলিয়ে TCP Segment বের করে।
       │
[ Transport Layer ] ──► Destination Port (5260) দেখে রিকোয়েস্ট অ্যাসেম্বল করে।
       │
[ Session Layer ]   ──► HTTP/2 সেশন এবং Stream ID ট্র্যাকিং করে ফ্রেমগুলো জোড়া দেয়।
       │
[Presentation Layer]──► TLS ডিক্রিপ্ট এবং gRPC-Web-কে ডিকোড করে Protobuf বাইনারি বের করে।
       │
[Application Layer] ──► C# Object-এ রূপান্তর করে MediatR ও EF Core দিয়ে প্রসেস করে।
```

### ১. সিগন্যাল ক্যাচিং (Physical)
সার্ভারের নেটওয়ার্ক ইন্টারফেস কার্ড (NIC) অ্যান্টেনার মাধ্যমে ওয়াইফাই তরঙ্গ রিসিভ করে। তরঙ্গের ভোল্টেজ বা ফ্রিকোয়েন্সির তারতম্য ডিকোড করে র বিট স্ট্রিম (`010110...`) জেনারেট করে।

### ২. এরর চেকিং ও ফ্রেম ওপেন (Data Link)
সার্ভারের ইথারনেট ড্রাইভার ফ্রেমের FCS রান করে দেখে ডাটা লাইনে কোনো নয়েজ ছিল কি না। সব ঠিক থাকলে নিজের MAC অ্যাড্রেসের সাথে ফ্রেমের ডেস্টিনেশন MAC অ্যাড্রেস মিলায়। মিলে গেলে ডাটালিংক হেডার কেটে ফেলে ভেতরের IP Packet-টি নেটওয়ার্ক স্ট্যাকের দিকে পাস করে।

### ৩. আইপি ও রাউটিং ভেরিফিকেশন (Network)
সার্ভারের ওএস (Kernel Space) আইপি হেডার রিড করে দেখে Destination IP সার্ভারের নিজস্ব আইপি কি না। যদি সঠিক হয়, তবে আইপি হেডার ট্রাঙ্কেট করে TCP Segment-টিকে ট্রান্সপোর্ট লেয়ারে পুশ করে।

### ৪. পোর্ট ও বাফারিং (Transport)
ওএস পোর্ট নাম্বার `5260` বা `7204` দেখে যে এটি একটি Kestrel Web Server-এর কানেকশন। ওএস ডাটা সেগমেন্টগুলোর সিকোয়েন্স নম্বর চেক করে সেগুলোকে বাফারে সাজায়। কোনো প্যাকেট হারিয়ে গেলে বা রি-অর্ডার হলে ওএস স্বয়ংক্রিয়ভাবে ক্লায়েন্টকে রিকোয়েস্ট পাঠিয়ে তা রি-অ্যাসুর করে এবং সম্পূর্ণ ডাটা স্ট্রিম তৈরি করে সেশন লেয়ারে দেয়।

### ৫. স্ট্রিম ও সিকিউরিটি ডিক্রিপশন (Session & Presentation)
* Kestrel ওয়েব সার্ভার HTTP/2 সেশন প্রসেস করে এবং মেসেজের Stream-ID আলাদা করে ফ্রেমগুলো জোড়া লাগায়।
* Presentation লেয়ারে TLS হ্যান্ডশেক কী দিয়ে এনক্রিপ্টেড ডাটাকে ডিক্রিপ্ট করে প্লেইন বাইনারি টেক্সটে ফিরিয়ে আনা হয়।
* `GrpcWebMiddleware` ৫-বাইটের gRPC-Web হেডার রিড করে বডির দৈর্ঘ্য নিশ্চিত করে এবং gRPC-Web ফ্রেম কেটে র বাইনারি Protobuf ডাটা এক্সট্র্যাক্ট করে।

### ৬. অ্যাপ্লিকেশন এক্সিকিউশন ও ডাটাবেজ অপারেশন (Application)
* **Protobuf Deserialization:** র বাইনারি ডাটা C# এর `CreateProductRequest` অবজেক্টে ডেসিরিয়ালাইজড হয়।
* **MediatR routing:** Presentation লেয়ারের [ProductGrpcService.cs](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/gRPC-Project/product-management-backend/src/ProductManagement.Presentation/Services/ProductGrpcService.cs) একটি `CreateProductCommand` পাঠিয়ে দেয়।
* **MediatR Handler:** [CreateProductCommandHandler](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/gRPC-Project/product-management-backend/src/ProductManagement.Application/Features/Products/Commands/CreateProduct/CreateProductCommand.cs) কমান্ডটি প্রসেস করে এবং বিজনেস লজিক অনুযায়ী ডোমেইন এন্টিটি `Product` তৈরি করে।
* **EF Core & Database Action:** 
  [ProductRepository](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/gRPC-Project/product-management-backend/src/ProductManagement.Infrastructure/Repositories/ProductRepository.cs) এ `AddAsync` মেথড রান হয়। EF Core এই অবজেক্টের উপর ভিত্তি করে নিচের মতো একটি SQL কুয়েরি জেনারেট করে:
  ```sql
  INSERT INTO "Products" ("Name", "Description", "Price", "Stock")
  VALUES (@name, @desc, @price, @stock)
  RETURNING "Id";
  ```
  * Npgsql ড্রাইভার একটি ডেডিকেটেড ডাটাবেজ TCP কানেকশনের মাধ্যমে PostgreSQL (Supabase)-এ কুয়েরি পাঠিয়ে দেয়। 
  * ডাটাবেজ রেকর্ডটি টেবিলে রাইট করে স্বয়ংক্রিয়ভাবে জেনারেট হওয়া প্রাইমারি কি `Id` (যেমন: `42`) সার্ভারে ব্যাক করে।
  * EF Core মেমোরিতে থাকা এন্টিটির `Id` ফিল্ডের ভ্যালু `42` দিয়ে আপডেট করে।
* **Response Generation:** হ্যান্ডলার একটি `ProductDto` রিটার্ন করে। সার্ভিসটি সেই DTO-কে `ProductResponse` প্রোটো মেসেজে কনভার্ট করে। মেসেজটি আবার Presentation লেয়ারে গিয়ে বাইনারি সিরিয়ালাইজ ও এনক্রিপ্ট হয়ে ক্লায়েন্টে ফেরত যায়।

---

## 📈 GetAllProducts (Read Operation) এর পার্থক্য

`GetAllProducts` কুয়েরির ক্ষেত্রেও সম্পূর্ণ OSI ফ্লো হুবহু এক থাকে, শুধু ডাটা লোডিং এবং কুয়েরি এক্সিকিউশনের ধাপে পার্থক্য ঘটে:

1. **রিকোয়েস্ট সাইড:** ক্লায়েন্ট থেকে কোনো ফিল্টার বা বডি ছাড়াই খালি একটি `GetAllProductsRequest` রিকোয়েস্ট পাঠানো হয়।
2. **ডাটাবেজ রিড:** MediatR Handler [GetAllProductsQueryHandler](file:///Users/barik/Desktop/Study/HighLevelDesignHLD/OSI/gRPC-Project/product-management-backend/src/ProductManagement.Application/Features/Products/Queries/GetAllProducts/GetAllProductsQuery.cs) রান হয়। এটি EF Core-কে ডাটা রিড করতে বলে।
3. **SQL Translation:** EF Core ডাটাবেজ থেকে সব প্রোডাক্ট রিড করার জন্য কুয়েরি পাঠায়:
  ```sql
  SELECT "Id", "Name", "Description", "Price", "Stock" FROM "Products";
  ```
4. **রেসপন্স সাইড:** ডাটাবেজ থেকে পাওয়া সব প্রোডাক্টের লিস্টকে `repeated Product` বাইনারি মেসেজ অ্যারেতে রূপান্তর করে gRPC-Web রেসপন্স আকারে ব্রাউজারে ফেরত পাঠানো হয়।
