-- Stable provenance only. Catalog metadata and inventory reconciliation remain separate operations.
CREATE TABLE IF NOT EXISTS dbo.catalogimportmappings (
  importsource varchar(50) NOT NULL,
  entitytype varchar(25) NOT NULL CHECK (entitytype IN ('Category','Product','Variant')),
  externalid varchar(100) NOT NULL,
  nativeid integer NOT NULL,
  sourcekey varchar(100),
  createdat timestamptz NOT NULL DEFAULT now(),
  updatedat timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (importsource, entitytype, externalid),
  UNIQUE (importsource, entitytype, nativeid)
);

COMMENT ON TABLE dbo.catalogimportmappings IS 'Stable external catalog source mappings; never use to infer stock.';
