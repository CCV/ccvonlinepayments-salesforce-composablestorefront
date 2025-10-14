var ProductMgr = function(){};
var Product = require('./Product');

ProductMgr.getProduct = function(){
	return new Product()
};

ProductMgr.queryAllSiteProducts = function(){};
ProductMgr.queryProductsInCatalog = function(){};
ProductMgr.queryAllSiteProductsSorted = function(){};
ProductMgr.queryProductsInCatalogSorted = function(){};
ProductMgr.prototype.product=null;

module.exports = ProductMgr;
