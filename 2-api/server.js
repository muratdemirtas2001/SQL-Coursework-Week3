const express = require("express");
const app = express();
const { Pool } = require("pg");
app.use(express.json());

app.listen(3000, function () {
  console.log("Server is listening on port 3000. Ready to accept requests!");
});

const pool = new Pool({
  user: "codeyourfuture",
  host: "localhost",
  database: "cyf_ecommerce",
  password: "codeyourfuture",
  port: 5432,
});

app.get("/customers", function (req, res) {
  pool.query("SELECT * FROM customers", (error, result) => {
    res.json(result.rows);
  });
});

app.get("/customers/:customerId", function (req, res) {
  const customerId = req.params.customerId;
  pool.query(
    "SELECT * FROM customers WHERE customers.id=$1",
    [customerId],
    (error, result) => {
      res.json(result.rows);
    }
  );
});

app.get("/suppliers", function (req, res) {
  pool.query("SELECT * FROM suppliers", (error, result) => {
    res.json(result.rows);
  });
});

app.get("/products", function (req, res) {
  let productName = req.query.name;
  //   productName=""
  console.log(productName);
  if (productName) {
    console.log("product yes");
    const query =
      "SELECT products.product_name,product_availability.unit_price,suppliers.supplier_name FROM products INNER JOIN product_availability ON products.id=product_availability.prod_id INNER JOIN suppliers ON product_availability.supp_id=suppliers.id WHERE product_name LIKE $1";
    pool.query(query, [productName], (error, result) => {
      res.json(result.rows);
    });
  } else {
    const query =
      "SELECT products.product_name,product_availability.unit_price,suppliers.supplier_name FROM products INNER JOIN product_availability ON products.id=product_availability.prod_id INNER JOIN suppliers ON product_availability.supp_id=suppliers.id ";
    pool.query(query, (error, result) => {
      res.json(result.rows);
    });
  }
});

// Add a new POST endpoint /customers to create a new customer with name, address, city and country.
app.post("/customers", function (req, res) {
  const { name, address, city, country } = req.body;
  pool.query(
    "INSERT INTO customers (name,address,city,country) VALUES ($1,$2,$3,$4)",
    [name, address, city, country],
    (error, result) => {
      res.send("updated");
    }
  );
});
app.post("/products", function (req, res) {
  const product_name = req.body.product_name;
  pool.query(
    "INSERT INTO products (product_name) VALUES ($1)",
    [product_name],
    (error, result) => {
      res.send("updated");
    }
  );
});
// Add a new POST endpoint /availability to create a new product availability (with a price and a supplier id). Check that the price is a positive integer and that both the product and supplier ID's exist in the database, otherwise return an error.
app.post("/availability", function (req, res) {
  const { prod_id, supp_id, unit_price } = req.body;
  if (unit_price < 1) {
    res.status(404).send("unit price can't be negative");
  } else {
    pool
      .query("SELECT * FROM products WHERE id=$1", [prod_id])
      .then((result) => {
        console.log(result.rows);
        if (result.rows.length > 0) {
          pool
            .query("SELECT * FROM suppliers WHERE id=$1", [supp_id])
            .then((result) => {
              if (result.rows.length > 0) {
                console.log("one");
                pool.query(
                  "INSERT INTO product_availability (prod_id,supp_id,unit_price) VALUES ($1,$2,$3)",
                  [prod_id, supp_id, unit_price]
                );
              } else {
                res.status(400).send("check supplier id");
              }
            });
        } else {
          res.status(400).send("check product id");
        }
      });
  }
});
// Add a new POST endpoint /customers/:customerId/orders to create a new order (including an order date, and an order reference) for a customer. Check that the customerId corresponds to an existing customer or return an error.

app.post("/customers/:customerId/orders", function (req, res) {
  const { order_date, order_reference } = req.body;
  console.log("hello from orders post");

  pool
    .query("SELECT * FROM customers WHERE id=$1", [req.params.customerId])
    .then((result) => {
      if (result.rows.length > 0) {
        pool
          .query(
            "INSERT INTO orders (order_date,order_reference,customer_id) VALUES ($1,$2,$3)",
            [order_date, order_reference, req.params.customerId]
          )
          .then(() => res.send("order has been updated"));
      } else {
        res.status(400).send("check customer id");
      }
    });
});

// Add a new PUT endpoint /customers/:customerId to update an existing customer (name, address, city and country).

app.put("/customers/:customerId", function (req, res) {
  const { name, address, city, country } = req.body;
  pool
    .query("SELECT * FROM customers WHERE id=$1", [req.params.customerId])
    .then((result) => {
      if (result.rows.length > 0) {
        pool
          .query(
            "UPDATE customers SET name=$1, address=$2, city=$3, country=$4 WHERE id=$5",
            [name, address, city, country, req.params.customerId]
          )
          .then(() => res.send("customer info has been updated"));
      } else {
        res.status(400).send("check customer id");
      }
    });
});

// Add a new DELETE endpoint /orders/:orderId to delete an existing order along with all the associated order items.

app.delete("/orders/:orderId", function (req, res) {
  const orderId = req.params.orderId;
  pool
    .query("SELECT * FROM order_items WHERE order_id=$1", [orderId])
    .then((result) => {
      if (result.rows.length > 0) {
        pool
          .query("DELETE FROM order_items WHERE order_id=$1", [orderId])
          .then(() =>
            pool
              .query("DELETE FROM orders WHERE id=$1", [orderId])
              .then(() => res.send(`Order ${orderId} deleted!`))
              .catch((e) => res.send(JSON.stringify(e)))
          );
      } else {
        res.send("check order id");
      }
    });
});

// Add a new DELETE endpoint /customers/:customerId to delete an existing customer only if this customer doesn't have orders.

app.delete("/customers/:customerId", function (req, res) {
  const customerId = req.params.customerId;
  pool
    .query("SELECT * FROM orders WHERE customer_id=$1", [customerId])
    .then((result) => {
      if (result.rows.length > 0) {
        res.send("can't delete customer, customer has orders");
      } else {
        pool.query(
          "DELETE FROM customers WHERE id=$1",
          [customerId],
          (error, result) => {
            res.json({ message: "customer deleted" });
          }
        );
      }
    });
});

// Add a new GET endpoint /customers/:customerId/orders to load all the orders along with the items in the orders of a specific customer. Especially, the following information should be returned: order references, order dates, product names, unit prices, suppliers and quantities.

app.get("/customers/:customerId/orders", function (req, res) {
  const customerId = req.params.customerId;
  const query =
    "SELECT name,order_reference,order_date,unit_price,supplier_name, product_name,quantity FROM customers INNER JOIN orders ON customers.id=orders.customer_id INNER JOIN order_items ON orders.id=order_items.order_id INNER JOIN product_availability ON order_items.product_id=product_availability.prod_id AND order_items.supplier_id=product_availability.supp_id INNER JOIN suppliers  ON suppliers.id=product_availability.supp_id INNER JOIN products ON products.id=product_availability.prod_id WHERE customers.id=$1";

  pool.query(query, [customerId], (error, result) => {
    if (result.rows.length === 0) {
      res.send("please check customer id");
    } else {
      res.json(result.rows);
    }
  });
});
