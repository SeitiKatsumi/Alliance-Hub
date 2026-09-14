// Derived from the official CadastroPj OpenAPI contract, 2026-09-09.
export default {
  "required": [
    "Nome",
    "DataNascimento",
    "Sexo",
    "Cpf",
    "Rg",
    "RgEmissor",
    "RgDataEmissao",
    "Email",
    "EstadoCivil",
    "GrauEscolar",
    "NomeMae",
    "NomePai",
    "DdiCelular",
    "DddCelular",
    "NumeroCelular",
    "Operadora",
    "TipoSO",
    "EnderecoResidencial",
    "TelefoneResidencial",
    "EnderecoComercial",
    "TelefoneComercial",
    "RazaoSocial",
    "NomeFantasia",
    "CNPJ",
    "DataConstituicao",
    "RamoAtividade"
  ],
  "type": "object",
  "properties": {
    "Nome": {
      "type": "string",
      "maxLength": 100
    },
    "DataNascimento": {
      "type": "string",
      "format": "date-time"
    },
    "Sexo": {
      "type": "string",
      "maxLength": 1
    },
    "Cpf": {
      "type": "integer",
      "format": "int64"
    },
    "Rg": {
      "type": "string",
      "maxLength": 20
    },
    "RgEmissor": {
      "type": "string",
      "maxLength": 10
    },
    "RgDataEmissao": {
      "type": "string",
      "format": "date-time"
    },
    "Email": {
      "type": "string",
      "maxLength": 100
    },
    "EstadoCivil": {
      "type": "string",
      "enum": [
        "Solteiro",
        "Casado",
        "Divorciado",
        "Viuvo"
      ]
    },
    "GrauEscolar": {
      "type": "string",
      "enum": [
        "PrimeiroGrauIncompleto",
        "PrimeiroGrauCompleto",
        "SegundoGrauIncompleto",
        "SegundoGrauCompleto",
        "TerceiroGrauIncompleto",
        "TerceiroGrauCompleto"
      ]
    },
    "NomeMae": {
      "type": "string",
      "maxLength": 100
    },
    "NomePai": {
      "type": "string",
      "maxLength": 100
    },
    "PaisOrigem": {
      "type": "string",
      "enum": [
        "Brasil"
      ]
    },
    "DdiCelular": {
      "type": "integer",
      "format": "int32"
    },
    "DddCelular": {
      "type": "integer",
      "format": "int32"
    },
    "NumeroCelular": {
      "type": "integer",
      "format": "int64"
    },
    "Operadora": {
      "type": "string",
      "enum": [
        "Claro",
        "Vivo",
        "Tim",
        "Nextel",
        "BrTelecon",
        "Oi",
        "Outra"
      ]
    },
    "TipoSO": {
      "type": "string",
      "enum": [
        "Android",
        "IOS",
        "Outra"
      ]
    },
    "EnderecoResidencial": {
      "required": [
        "EndeResCep",
        "EndeResLogradouro",
        "EndeResNumero",
        "EndeResEstado",
        "EndeResCidade",
        "EndeResBairro"
      ],
      "type": "object",
      "properties": {
        "EndeResCep": {
          "type": "integer",
          "format": "int32"
        },
        "EndeResLogradouro": {
          "type": "string",
          "maxLength": 100
        },
        "EndeResNumero": {
          "type": "string",
          "maxLength": 5
        },
        "EndeResComplemento": {
          "type": "string",
          "maxLength": 100
        },
        "EndeResEstado": {
          "type": "string",
          "maxLength": 2
        },
        "EndeResCidade": {
          "type": "string",
          "maxLength": 100
        },
        "EndeResBairro": {
          "type": "string",
          "maxLength": 100
        }
      }
    },
    "TelefoneResidencial": {
      "required": [
        "DdiTelefoneResidencial",
        "DddTelefoneResidencial",
        "NumeroTelefoneResidencial"
      ],
      "type": "object",
      "properties": {
        "DdiTelefoneResidencial": {
          "type": "integer",
          "format": "int32"
        },
        "DddTelefoneResidencial": {
          "type": "integer",
          "format": "int32"
        },
        "NumeroTelefoneResidencial": {
          "type": "integer",
          "format": "int64"
        }
      }
    },
    "EnderecoComercial": {
      "required": [
        "EndeComCep",
        "EndeComLogradouro",
        "EndeComNumero",
        "EndeComEstado",
        "EndeComCidade",
        "EndeComBairro"
      ],
      "type": "object",
      "properties": {
        "EndeComCep": {
          "type": "string"
        },
        "EndeComLogradouro": {
          "type": "string",
          "maxLength": 100
        },
        "EndeComNumero": {
          "type": "string",
          "maxLength": 5
        },
        "EndeComComplemento": {
          "type": "string",
          "maxLength": 100
        },
        "EndeComEstado": {
          "type": "string",
          "maxLength": 2
        },
        "EndeComCidade": {
          "type": "string",
          "maxLength": 100
        },
        "EndeComBairro": {
          "type": "string",
          "maxLength": 100
        }
      }
    },
    "TelefoneComercial": {
      "required": [
        "DddTelefoneComercial",
        "NumeroTelefoneComercial",
        "RamalTelefoneComercial"
      ],
      "type": "object",
      "properties": {
        "DddTelefoneComercial": {
          "type": "integer",
          "format": "int32"
        },
        "NumeroTelefoneComercial": {
          "type": "integer",
          "format": "int64"
        },
        "RamalTelefoneComercial": {
          "type": "integer",
          "format": "int32"
        }
      }
    },
    "DadosBancarios": {
      "type": "object",
      "properties": {
        "CodBanco": {
          "type": "string",
          "maxLength": 15
        },
        "Agencia": {
          "type": "string",
          "maxLength": 15
        },
        "Conta": {
          "type": "string",
          "maxLength": 20
        },
        "TipoConta": {
          "type": "string",
          "enum": [
            "Corrente",
            "Poupanca"
          ]
        },
        "NomeContaCorrente": {
          "type": "string",
          "maxLength": 100
        },
        "CpfCnpjContaCorrente": {
          "type": "integer",
          "format": "int64"
        }
      }
    },
    "RazaoSocial": {
      "type": "string",
      "maxLength": 100
    },
    "NomeFantasia": {
      "type": "string",
      "maxLength": 100
    },
    "CNPJ": {
      "type": "integer",
      "format": "int64"
    },
    "DataConstituicao": {
      "type": "string",
      "format": "date-time"
    },
    "NomeComprovante": {
      "type": "string",
      "maxLength": 100
    },
    "ListaSocios": {
      "type": "array",
      "items": {
        "required": [
          "NomeSocio",
          "CpfSocio"
        ],
        "type": "object",
        "properties": {
          "NomeSocio": {
            "type": "string",
            "maxLength": 50
          },
          "CpfSocio": {
            "type": "integer",
            "format": "int64"
          },
          "PepSocio": {
            "type": "boolean"
          }
        }
      }
    },
    "RamoAtividade": {
      "type": "integer",
      "format": "int32"
    },
    "Pep": {
      "type": "boolean"
    },
    "RendaPatrimonio": {
      "type": "object",
      "properties": {
        "FaixaRenda": {
          "type": "string"
        },
        "OrigemRenda": {
          "type": "string"
        },
        "ComentarioOrigemRenda": {
          "type": "string"
        },
        "FaixaPatrimonio": {
          "type": "string"
        }
      }
    }
  }
};
