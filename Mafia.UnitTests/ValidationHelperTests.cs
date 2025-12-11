using Mafia.Helpers;
using Xunit;

namespace Mafia.UnitTests;

public class ValidationHelperTests
{
    [Fact]
    public void ValidateNotEmpty_WithValidString_ShouldNotThrow()
    {
        // Arrange
        var validString = "test";

        // Act & Assert
        var exception = Record.Exception(() => ValidationHelper.ValidateNotEmpty(validString, "testParam"));
        Assert.Null(exception);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidateNotEmpty_WithInvalidString_ShouldThrowArgumentException(string? invalidString)
    {
        // Act & Assert
        var exception = Assert.Throws<ArgumentException>(() => 
            ValidationHelper.ValidateNotEmpty(invalidString, "testParam"));
        
        Assert.Contains("testParam", exception.Message);
    }

    [Fact]
    public void ValidateNotNull_WithValidObject_ShouldNotThrow()
    {
        // Arrange
        var validObject = new object();

        // Act & Assert
        var exception = Record.Exception(() => ValidationHelper.ValidateNotNull(validObject, "testParam"));
        Assert.Null(exception);
    }

    [Fact]
    public void ValidateNotNull_WithNull_ShouldThrowArgumentNullException()
    {
        // Act & Assert
        var exception = Assert.Throws<ArgumentNullException>(() => 
            ValidationHelper.ValidateNotNull(null, "testParam"));
        
        Assert.Contains("testParam", exception.Message);
    }

    [Fact]
    public void ValidateNotEmpty_WithValidCollection_ShouldNotThrow()
    {
        // Arrange
        var validCollection = new List<int> { 1, 2, 3 };

        // Act & Assert
        var exception = Record.Exception(() => 
            ValidationHelper.ValidateNotEmpty(validCollection, "testParam"));
        Assert.Null(exception);
    }

    [Fact]
    public void ValidateNotEmpty_WithEmptyCollection_ShouldThrowArgumentException()
    {
        // Arrange
        var emptyCollection = new List<int>();

        // Act & Assert
        var exception = Assert.Throws<ArgumentException>(() => 
            ValidationHelper.ValidateNotEmpty(emptyCollection, "testParam"));
        
        Assert.Contains("testParam", exception.Message);
    }

    [Fact]
    public void ValidatePositive_WithPositiveNumber_ShouldNotThrow()
    {
        // Act & Assert
        var exception = Record.Exception(() => ValidationHelper.ValidatePositive(5, "testParam"));
        Assert.Null(exception);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public void ValidatePositive_WithNonPositiveNumber_ShouldThrowArgumentException(int invalidNumber)
    {
        // Act & Assert
        var exception = Assert.Throws<ArgumentException>(() => 
            ValidationHelper.ValidatePositive(invalidNumber, "testParam"));
        
        Assert.Contains("testParam", exception.Message);
    }
}
