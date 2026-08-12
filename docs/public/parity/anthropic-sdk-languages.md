# SDK language support

Allternit ships first-class SDKs for **TypeScript** (`@allternit/sdk`) and **Python** (`allternit`). Because the public API is OpenAI-compatible at `/v1`, you can also use the official OpenAI SDK in other languages and only change the base URL.

## Using an OpenAI-compatible SDK

Any language with an OpenAI client can call Allternit by setting:

```text
base_url = "https://api.allternit.com/v1"
api_key  = your Allternit virtual key
```

### Go

```go
client, err := openai.NewClient(
    option.WithBaseURL("https://api.allternit.com/v1"),
    option.WithAPIKey(os.Getenv("ALLTERNIT_API_KEY")),
)
```

### Java

```java
OpenAIClient client = OpenAIClient.builder()
    .baseUrl("https://api.allternit.com/v1")
    .apiKey(System.getenv("ALLTERNIT_API_KEY"))
    .build();
```

### C# / .NET

```csharp
var client = new OpenAIClient(
    new Uri("https://api.allternit.com/v1"),
    new ApiKeyCredential(Environment.GetEnvironmentVariable("ALLTERNIT_API_KEY"))
);
```

### PHP

```php
$client = OpenAI::factory()
    ->withBaseUri('https://api.allternit.com/v1')
    ->withApiKey(getenv('ALLTERNIT_API_KEY'))
    ->make();
```

### Ruby

```ruby
client = OpenAI::Client.new(
  access_token: ENV['ALLTERNIT_API_KEY'],
  uri_base: 'https://api.allternit.com/v1'
)
```

## Native Allternit SDKs

A native Go, Java, C#, PHP, or Ruby SDK can be generated from the Allternit OpenAPI description or built as a thin wrapper around the REST endpoints. The TypeScript and Python SDKs already contain the provider-agnostic harness, tool belt, and streaming abstractions; other languages will follow the same layered design.

## Related pages

- [TypeScript quickstart](../sdk/typescript-quickstart.md)
- [Python quickstart](../sdk/python-quickstart.md)
- [API reference](../api/reference.md)
